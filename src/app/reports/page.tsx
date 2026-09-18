"use client";

import { useState } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { downloadProjectReportPdf } from "@/lib/projectReportPdf";
import { SkeletonCards } from "@/components/ui/Loading";

export default function ReportsPage() {
  const { projects, loading } = useProjects();
  const { displayName } = useAuth();
  const [generating, setGenerating] = useState<number | null>(null);
  const [error, setError] = useState("");

  const openReportPdf = async (projectId: number) => {
    if (generating != null) return;
    setGenerating(projectId);
    setError("");
    try {
      const res = await fetch(`/api/reports/${projectId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Не удалось сформировать отчёт");
      }
      const data = await res.json();
      const result = await downloadProjectReportPdf(data, {
        mode: "full",
        authorName: displayName || data.author_name,
      });
      if (result.warnings.length) {
        setError(`PDF сохранён. Внимание: ${result.warnings.join("; ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания PDF");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 rounded-lg hover:bg-surface-muted text-ink-muted hover:text-ink touch-target"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-ink">Отчёты</h1>
          <p className="text-ink-muted text-sm mt-0.5">
            Скачать фирменный PDF-отчёт по объекту
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <SkeletonCards count={3} className="sm:grid-cols-2" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="p-5 flex flex-col gap-3">
                <h2 className="font-semibold text-ink">{project.name}</h2>
                <p className="text-sm text-ink-muted line-clamp-2">{project.address}</p>
                <div className="mt-auto flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => void openReportPdf(project.id)}
                    disabled={generating === project.id}
                    fullWidth
                  >
                    {generating === project.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    {generating === project.id ? "Создаю PDF…" : "Скачать PDF"}
                  </Button>
                  <Link
                    href={`/reports/${project.id}`}
                    className="text-center text-sm text-muted hover:text-ink"
                  >
                    Предпросмотр
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
