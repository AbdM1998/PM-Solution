import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectBoard } from "@/components/board/ProjectBoard";

export default function BoardPage() {
  return (
    <div>
      <PageHeader title="Board" description="Every task across your projects, by status. Drag a card to change its status." />
      <ProjectBoard />
    </div>
  );
}
