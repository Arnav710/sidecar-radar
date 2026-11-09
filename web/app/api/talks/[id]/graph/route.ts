import type { GraphEdge, GraphNode, GraphResponse } from "@sidecar/shared";
import type { PersonDoc } from "@sidecar/shared/people";
import { withSpan } from "@sidecar/shared/otel";
import { es, INDEX } from "@/lib/es";
import { candidatesFor } from "@/lib/matching";

export const dynamic = "force-dynamic";

const MAX_PEOPLE = 40;

/** Blind label for the projector: role and experience, never a name. */
function label(p: PersonDoc): string {
  const role = p.role || "Attendee";
  return p.years ? `${role} · ${p.years}y` : role;
}

// The people graph for one talk (projector view). Everyone in the talk runs the
// same linear-retriever match query, restricted to the others in the talk; all
// queries go to Elasticsearch in one _msearch per person batch. Bold edges =
// same problem (from questions), dashed = same interests (schedule overlap).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withSpan("sidecar.graph", { "sidecar.talk.id": id }, async (set) => {
    const res = await es().search<PersonDoc>({
      index: INDEX.people,
      size: MAX_PEOPLE,
      query: { bool: { should: [{ term: { asked_in: id } }, { term: { talk_ids: id } }], minimum_should_match: 1 } },
      sort: [{ updated_at: "desc" }],
    });
    const people = res.hits.hits.map((h) => h._source!).filter(Boolean);
    const uids = people.map((p) => p.uid);
    const inTalk = [{ terms: { uid: uids } }];

    const lists = await Promise.all(people.map((p) => candidatesFor(p, inTalk, 5).catch(() => [])));
    const edges = new Map<string, GraphEdge>();
    people.forEach((p, i) => {
      for (const c of lists[i]) {
        const key = [p.uid, c.person.uid].sort().join("__");
        const kind = c.sameProblem ? "same_problem" : "same_interests";
        const prev = edges.get(key);
        // Keep the strongest view of the pair; "same problem" wins over "same interests".
        if (!prev || (kind === "same_problem" && prev.kind !== "same_problem") || c.score > prev.score) {
          edges.set(key, { source: p.uid, target: c.person.uid, kind: prev?.kind === "same_problem" ? "same_problem" : kind, score: c.score });
        }
      }
    });

    const nodes: GraphNode[] = people.map((p) => ({ id: p.uid, label: label(p), demo: p.demo, asked: p.asked_in.includes(id) }));
    set({ "sidecar.graph.nodes": nodes.length, "sidecar.graph.edges": edges.size });
    const body: GraphResponse = { talk_id: id, nodes, edges: [...edges.values()], generated_at: new Date().toISOString() };
    return Response.json(body);
  });
}
