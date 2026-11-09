import { Logo } from "@/components/Logo";
import { PlanBoard } from "@/components/PlanBoard";

export const dynamic = "force-dynamic";

export default function PlanPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Logo />
      </header>
      <h1 className="mt-8 text-4xl font-extrabold sm:text-5xl">
        Your day, <span className="marker">planned</span>
      </h1>
      <p className="mt-3 max-w-xl text-lg text-ink-soft">
        Picked from the talks and side events around the conference for what you are working on. Swap anything, and keep the open slots for meeting people.
      </p>
      <div className="mt-8">
        <PlanBoard />
      </div>
    </main>
  );
}
