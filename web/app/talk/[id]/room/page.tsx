import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { RoomCapture } from "@/components/RoomCapture";
import { getTalk } from "@/lib/talks";

export const dynamic = "force-dynamic";

// The room laptop: captures the speaker's voice and shows a big QR code so the
// audience can join. Opened with ?key=<speaker token>, so only the room can post.
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;
  const talk = await getTalk(id);
  if (!talk) notFound();

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const joinUrl = `${origin}/talk/${talk.id}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 1, color: { dark: "#17131f", light: "#fff6e6" } });

  return (
    <RoomCapture
      talk={{ id: talk.id, title: talk.title, speaker: talk.speaker, room_id: talk.room_id, start: talk.start }}
      roomKey={key ?? ""}
      keyOk={key === talk.speaker_token}
      joinUrl={joinUrl}
      qrSvg={qrSvg}
    />
  );
}
