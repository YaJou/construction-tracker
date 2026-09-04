"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/useProjects";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, FileText } from "lucide-react";

export default function ReportsPage() {
  const { projects, loading } = useProjects();
  const [generating, setGenerating] = useState<number | null>(null);

  const openReportPdf = (projectId: number) => {
    setGenerating(projectId);
    const w = window.open(`/reports/${projectId}?print=1`, "_blank", "noopener");
    const checkClosed = setInterval(() => {
      if (w?.closed) {
        clearInterval(checkClosed);
        setGenerating(null);
      }
    }, 500);
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
            Сформировать отчёт по объекту для руководителя или клиента
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="p-5 flex flex-col gap-3">
                <h2 className="font-semibold text-ink">{project.name}</h2>
                <p className="text-sm text-ink-muted line-clamp-2">{project.address}</p>
                <Button
                  variant="secondary"
                  onClick={() => openReportPdf(project.id)}
                  disabled={generating === project.id}
                  fullWidth
                  className="mt-auto"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {generating === project.id ? "Открываю…" : "Сформировать отчёт (PDF)"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
