import { createFileRoute } from "@tanstack/react-router";
import { handleCampusChat } from "@/lib/ai/campus-chat.server";

export const Route = createFileRoute("/api/chat")({
  server: { handlers: { POST: ({ request }) => handleCampusChat(request) } },
});
