import { PageHeader } from "@/components/layout/PageHeader";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";

export default function CalendarPage() {
  return (
    <div>
      <PageHeader title="Calendar" description="Due dates across tasks, checklists and reminders." />
      <MonthCalendar />
    </div>
  );
}
