import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UsersRound, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { StyledSelect } from "@/components/ui/styled-select";
import { Skeleton } from "@/components/ui/skeleton";

const TeacherRosterPage = () => {
  const { t } = useTranslation();
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
    <header>
      <p className="eyebrow">{t("nav.roster")}</p>
      <h1 className="page-title mt-2.5">{t("teacherSpace.rosterTitle")}</h1>
      <span className="brand-rule" />
      <p className="text-muted-foreground mt-4">{t("teacherSpace.rosterSubtitle")}</p>
    </header>

    {/* Every assigned group at a glance; click one to open its list. */}
    <section className="glass-panel p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary" />
        <h2 className="eyebrow">{t("teacherSpace.myGroups")}{!groupsLoading && ` · ${groups.length}`}</h2>
      </div>
      {groupsLoading ? <Skeleton className="h-10" /> : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("teacherSpace.noGroups")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setGroupId(group.id)}
                aria-pressed={group.id === groupId}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  group.id === groupId ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40"}`}
              >
                {group.name}
                <span className={`ml-1.5 text-xs font-medium ${group.id === groupId ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{group.student_count}</span>
              </button>
            ))}
          </div>
          {groups.length > 12 && (
            <div className="max-w-sm">
              <StyledSelect
                value={groupId ? String(groupId) : ""}
                onValueChange={(value) => setGroupId(value ? Number(value) : null)}
                placeholder={t("teacherSpace.selectGroup")}
                options={groups.map((group) => ({ label: `${group.name} (${t("teacherSpace.studentsCount", { count: group.student_count })})`, value: String(group.id) }))}
              />
            </div>
          )}
        </>
      )}
    </section>

    {groups.length > 0 && <section className="glass-panel overflow-hidden">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <UsersRound className="w-5 h-5 text-primary" />
        <div>
          <h2 className="font-semibold">{selectedGroup?.name ?? t("teacherSpace.group")}</h2>
          <p className="text-xs text-muted-foreground">{t("teacherSpace.readOnly")}</p>
        </div>
      </div>
      {studentsLoading ? <Skeleton className="h-32 m-4" /> : <div className="divide-y divide-border/50">
        {students.map((student) => <div key={student.id} className="px-4 py-3 flex justify-between gap-3 text-sm"><span>{student.first_name} {student.last_name}</span><span className="mono-figure text-xs text-muted-foreground">{student.cne}</span></div>)}
        {groupId && students.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("teacherSpace.noStudents")}</p>}
      </div>}
    </section>}
  </div>;
};

export default TeacherRosterPage;
