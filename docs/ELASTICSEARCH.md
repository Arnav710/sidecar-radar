# Sidecar on Elasticsearch: the technical design

Elasticsearch is not a database we bolted search onto. It is the engine for every decision Sidecar makes: what to answer, where to send you next, who to meet, where to meet them, and what the speaker should fix. Each feature below uses an Elasticsearch capability for a reason we can explain on stage.

Tested on Elasticsearch 8.18 (local Docker, trial license) and designed for Elastic Cloud Serverless (Elasticsearch project).

| Product moment | Elasticsearch capability | Why this one |
|---|---|---|
| Answer a question from the live talk | `rrf` retriever (BM25 + `semantic_text`) + recency decay + `text_similarity_reranker` | Exact terms ("tail sampling") and meaning ("keep the broken requests") both matter; the last minutes matter most |
| Where to go next | Hybrid search over `talks` with `status`/`start` filters | Past recordings and upcoming talks from one query each |
| Who to meet | **`linear` retriever** with weights 0.6 / 0.3 / 0.1 and `minmax` normalization | The match formula runs inside ES, one query per person, every weight explainable |
| Rarity-weighted schedule overlap | **BM25 IDF on a whitespace-analyzed field of talk ids** | Lucene already weights rare terms higher; rare talks *are* rare terms |
| Why you matched (blind card evidence) | Semantic highlighting on `semantic_text` + `collapse` on `uid` | Shows the matching problem chunk, one best match per person |
| The people graph | `_msearch` of everyone's match query | One round trip builds every edge for the projector |
| Where to meet | `geo_point` + `geo_distance` sort + live crowd filter | Nearest uncrowded spot to the midpoint of both next rooms |
| Cross-room alerts | **Percolator** | Store the query, match each new transcript line against all saved interests |
| Speaker report | `histogram` + `filters` + `cardinality` + **`bucket_selector`** + `significant_text` | Confusion timeline with k-anonymity (≥ 3 people) enforced inside the aggregation |
| Live conference pulse | **ES\|QL** | `STATS ... BY topic` over the last 10 minutes, readable on a slide |

---

## 1. Indices (all `dynamic: strict`)

| Index | Key fields |
|---|---|
| `sidecar-talks` | `title`, `abstract` → `abstract_semantic` (`semantic_text`), `room_id`, `start`, `end`, `status` (past/upcoming), `video_url`, `topics`, `level` |
| `sidecar-transcripts` | `talk_id`, `room_id`, `offset_s`, `ts`, `text` → `text_semantic` |
| `sidecar-questions` | `uid`, `talk_id`, `offset_s`, `text` → `text_semantic`, `type` (definition/applied/experience), `topic`, `problem` → `problem_semantic` |
| `sidecar-signals` | `uid_hash`, `talk_id`, `offset_s`, `type` (lost/got_it) |
| **`sidecar-people`** | One doc per attendee, rebuilt by the worker: `uid`, `display_name`, `open_to_meet`, `working_on` → semantic, **`problems`** (all their applied/experience problems, `semantic_text`), **`schedule`** (talk ids, `whitespace` analyzer, `norms: false`) |
| `sidecar-matches` | `uid_a`, `uid_b`, `score`, per-signal sub-scores, `shared_problem`, `shared_talks`, `state`, `kit` |
| `sidecar-follows` | `uid`, `topic`, `query` (**`percolator`**) |
| `sidecar-venue` | `id`, `name`, `kind` (room/coffee/lounge/quiet), `location` (**`geo_point`**), `capacity`, `live_count` |
| `sidecar-meetups` | `match_id`, `spot_id`, `start`, `end`, `state` |

Every text we search by meaning has a `semantic_text` twin filled by `copy_to`, so one field supports BM25 and semantic retrieval. Embeddings come from the cluster's inference endpoint (ELSER / E5 on Elastic Cloud); there is no embedding code in our app.

**Why a `people` index?** Matching ranks *people*, not questions. One document per person lets a single query combine three different signals about that person and return a ranked list of people directly.

---

## 2. Answering a question: hybrid + recency + rerank

```json
{
  "retriever": {
    "text_similarity_reranker": {
      "field": "text",
      "inference_id": ".rerank-v1-elasticsearch",
      "inference_text": "<question>",
      "rank_window_size": 20,
      "retriever": {
        "rrf": {
          "retrievers": [
            { "standard": { "query": { "function_score": {
                "query": { "bool": { "must": { "match": { "text": "<question>" } },
                                     "filter": { "term": { "talk_id": "<talk>" } } } },
                "functions": [{ "gauss": { "ts": { "origin": "now", "scale": "5m", "decay": 0.5 } } }] } } } },
            { "standard": { "query": { "bool": { "must": { "semantic": { "field": "text_semantic", "query": "<question>" } },
                                                 "filter": { "term": { "talk_id": "<talk>" } } } } } }
          ],
          "rank_window_size": 50
        }
      }
    }
  }
}
```
- **BM25** catches exact jargon ("tail sampling processor"). **Semantic** catches paraphrases ("keep the requests that failed").
- **RRF** merges the two rankings without tuning score scales.
- **Gaussian decay on `ts`** favors what was said in the last ~5 minutes, which is usually what you're confused about.
- **Reranker** (Elastic Rerank) re-orders the top 20 by reading question and line together. Optional; skipped if the inference endpoint isn't available.
- Then the same retriever without the `talk_id` filter for other talks, and over `talks` for a past recording (`status: past`, `exists: video_url`) and an upcoming talk (`start > now`).

---

## 3. Matching people: the formula runs inside Elasticsearch

The plan's score is `0.6 × question similarity + 0.3 × schedule overlap (rarity-weighted) + 0.1 × working-on similarity`. That is exactly one **`linear` retriever**:

```json
{
  "retriever": {
    "linear": {
      "retrievers": [
        { "retriever": { "standard": { "query": { "semantic": { "field": "problems", "query": "<my applied problems>" } } } },
          "weight": 0.6, "normalizer": "minmax" },
        { "retriever": { "standard": { "query": { "match": { "schedule": "<my talk ids, space separated>" } } } },
          "weight": 0.3, "normalizer": "minmax" },
        { "retriever": { "standard": { "query": { "semantic": { "field": "working_on", "query": "<my working on>" } } } },
          "weight": 0.1, "normalizer": "minmax" }
      ],
      "filter": [ { "term": { "open_to_meet": true } } ],
      "rank_window_size": 50
    }
  },
  "query_filter_note": "plus must_not { term: { uid: <me> } }",
  "highlight": { "fields": { "problems": { "type": "semantic", "number_of_fragments": 1 } } }
}
```
- **`minmax` normalization** puts all three signals on 0–1 before weighting, so the weights mean what they say.
- **Rarity weighting for free:** `schedule` is a `text` field with a `whitespace` analyzer and `norms: false`. Each talk id is a term, and BM25's **IDF** gives rare terms more weight. Sharing a niche deep dive outranks sharing the keynote, with no custom math. (Measured locally: sharing only the keynote scored 0.14; sharing the niche talk scored 1.74.) `norms: false` stops long schedules being penalized.
- **Definition questions never count:** only `applied` and `experience` problems are copied into `people.problems`.
- **Evidence for the blind card:** semantic highlighting returns the best-matching problem chunk ("reducing tracing costs without losing errors"); a `terms` lookup on both schedules gives the shared talks. We show the problem, never the raw question.
- **Thresholds:** a match card needs a combined score above a cutoff **and** a non-trivial question sub-score (or strong schedule overlap, which becomes a "schedule twin" card).

### The people graph (kept)
- The projector view runs **one `_msearch`** with the matching query for every attendee of the talk. Each hit above the cutoff is an edge.
- **Edge style comes from the sub-scores:** bold when the question signal dominates ("same problem"), dashed when it's mostly schedule ("same interests").
- The worker refreshes `sidecar-people` when a question is classified, so new edges appear seconds after a judge asks something.

---

## 4. Where to meet: geo

- Rooms and meeting spots live in `sidecar-venue` with `geo_point` locations (a local grid mapped to lat/lon around the venue).
- Meetup spot query: `filter: kind ∈ {coffee, lounge, quiet}` and `live_count < 0.8 × capacity`, `sort: _geo_distance` from the **midpoint of both people's next rooms**. One query, nearest uncrowded spot first.
- The first shared free slot comes from both schedules' `blocks` (a small range query per person; the gap finding is ~20 lines of code with unit tests).

---

## 5. Cross-room alerts: the percolator

- "Follow a topic" stores a query (`match` + `semantic` on the topic) in `sidecar-follows`, a `percolator` field.
- Every new transcript line is **percolated**: ES returns every stored interest that line matches, across all rooms, in one call. That's an inverted search: instead of each person polling for their topic, each line finds its people.

---

## 6. Speaker report: aggregations with privacy built in

```json
{
  "size": 0,
  "query": { "term": { "talk_id": "<talk>" } },
  "aggs": {
    "timeline": {
      "histogram": { "field": "offset_s", "interval": 60 },
      "aggs": {
        "people": { "cardinality": { "field": "uid_hash" } },
        "lost": { "filter": { "term": { "type": "lost" } } },
        "got_it": { "filter": { "term": { "type": "got_it" } } },
        "k_anonymous": { "bucket_selector": { "buckets_path": { "n": "people" }, "script": "params.n >= 3" } }
      }
    }
  }
}
```
- **`bucket_selector` drops any minute with fewer than 3 distinct people inside ES**, so identifiable data never reaches our app or the speaker.
- Question clusters: `terms` on `topic` with `min_doc_count: 3`.
- **`significant_text`** on question text for this talk vs. all questions finds what was *unusually* confusing here, not just common words.
- The transcript lines at each spike come from a range query on `offset_s`, and one LLM call writes the report.

---

## 7. Live pulse: ES|QL

A slide-friendly query for "what is the conference confused about right now":
```
FROM sidecar-questions
| WHERE ts > NOW() - 10 minutes AND type != "definition"
| STATS questions = COUNT(*), people = COUNT_DISTINCT(uid) BY topic
| WHERE people >= 3
| SORT questions DESC
| LIMIT 5
```

---

## 8. Operational notes

- All ES calls go through `web/lib/es.ts` and the worker's client; the Elastic client emits OpenTelemetry spans, so every query shows up in the Dash0 trace of the request that made it.
- Local Docker ES has no inference endpoint: `ES_SEMANTIC=off` switches to BM25-only mappings and queries. Elastic Cloud gets the full hybrid design.
- Local Docker tip: if indices go read-only, Docker's virtual disk is above the 90% watermark. For local dev only: `cluster.routing.allocation.disk.threshold_enabled: false`.
