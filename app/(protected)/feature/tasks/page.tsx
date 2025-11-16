import TaskWorkspaceShell from "@/components/TaskWorkspaceShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function TaskSchedulerFeature() {
  return <TaskWorkspaceShell />;
}
