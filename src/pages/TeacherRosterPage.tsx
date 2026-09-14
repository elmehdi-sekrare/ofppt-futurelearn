import { useEffect, useState } from "react";
import { UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { StyledSelect } from "@/components/ui/styled-select";
import { Skeleton } from "@/components/ui/skeleton";

const TeacherRosterPage = () => {
  const [groupId, setGroupId] = useState<number | null>(null);
  const { data: groupsRes, isLoading: groupsLoading } = useQuery({ queryKey: ["groups"], queryFn: api.getGroups });
  const groups = (groupsRes?.data ?? []).filter((group) => (group.status ?? "active") === "active");

  useEffect(() => {
    if (groupId == null && groups.length) setGroupId(groups[0].id);
  }, [groups, groupId]);

  const { data: studentsRes, isLoading: studentsLoading } = useQuery({
    queryKey: ["group-students", groupId],
    queryFn: () => api.getGroupStudents(groupId!),
    enabled: !!groupId,
  });
  const students = studentsRes?.data ?? [];
  const selectedGroup = groups.find((group) => group.id === groupId);

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-display font-bold">My Groups & Students</h1>
      <p className="text-sm text-muted-foreground mt-1">Select an assigned group to view its current roster.</p>
    </div>

    <section className="glass-panel p-5 space-y-3">
      <label className="text-sm text-muted-foreground">Group</label>
      {groupsLoading ? <Skeleton className="h-10" /> : <StyledSelect
        value={groupId ? String(groupId) : ""}
        onValueChange={(value) => setGroupId(value ? Number(value) : null)}
        placeholder="Select an assigned group"
        options={groups.map((group) => ({ label: `${group.name} (${group.student_count} students)`, value: String(group.id) }))}
      />}
    </section>

    <section className="glass-panel overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <UsersRound className="w-5 h-5 text-primary" />
        <div><h2 className="font-semibold">{selectedGroup?.name ?? "Students"}</h2><p className="text-xs text-muted-foreground">Read-only roster managed by administration</p></div>
      </div>
      {studentsLoading ? <Skeleton className="h-32 m-4" /> : <div className="divide-y divide-border/50">
        {students.map((student) => <div key={student.id} className="px-4 py-3 flex justify-between text-sm"><span>{student.first_name} {student.last_name}</span><span className="font-mono text-xs text-muted-foreground">{student.cne}</span></div>)}
        {groupId && students.length === 0 && <p className="p-4 text-sm text-muted-foreground">No students in this group yet.</p>}
      </div>}
    </section>
  </div>;
};

export default TeacherRosterPage;