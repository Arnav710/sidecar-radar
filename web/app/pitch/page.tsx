import { Logo } from "@/components/Logo";

// The one problem slide for the demo video, in the landing page's style.
const POINTS = [
  { icon: "🧭", c: "bg-lime", lead: "The value of a conference is the people.", rest: "But in a room of 500 you can’t tell who’s stuck on your problem." },
  { icon: "🫣", c: "bg-sky", lead: "Even when you find them, you don’t know how to start.", rest: "Many attendees are introverts, and walking up cold is hard." },
  { icon: "🤝", c: "bg-bubble", lead: "Sidecar uses the questions you ask in talks to find the people stuck on the same thing,", rest: "then starts the conversation for you: an opener, a time, a place." },
];

export default function Pitch() {
  return (
    <main className="page-dark flex min-h-dvh flex-col bg-ink text-paper [background-image:radial-gradient(rgba(255,246,230,0.07)_1px,transparent_1px)] [background-size:22px_22px]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-8 py-10">
        <Logo dark />
        <h1 className="mt-10 font-display text-5xl font-extrabold leading-[1.02] sm:text-6xl">
          Conferences cost thousands.
          <br />
          <span className="text-lime">Most people leave without meeting anyone useful.</span>
        </h1>
        <ul className="mt-12 space-y-5">
          {POINTS.map((p) => (
            <li key={p.lead} className="flex items-start gap-5 rounded-2xl border-2 border-paper/80 bg-ink-2 p-5">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-paper text-2xl ${p.c}`} aria-hidden="true">
                {p.icon}
              </span>
              <p className="text-xl leading-snug sm:text-2xl">
                <b className="font-display">{p.lead}</b> <span className="text-paper/75">{p.rest}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
