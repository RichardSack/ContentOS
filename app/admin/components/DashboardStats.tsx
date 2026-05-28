"use client";

interface Props {
  stats: {
    processing: any[];
    failed: any[];
    jobs: any[];
    accounts: any[];
    scheduled: any[];
  };
}

export default function DashboardStats({ stats }: Props) {
  return (
    <section className="mb-8 space-y-4">
      <h2 className="text-lg font-semibold">Dashboard</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-700 border border-surface-500 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats.processing.length}</div>
          <div className="text-xs text-gray-400">In Bearbeitung</div>
        </div>
        <div className="bg-surface-700 border border-surface-500 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats.failed.length}</div>
          <div className="text-xs text-gray-400">Fehlgeschlagen</div>
        </div>
        <div className="bg-surface-700 border border-surface-500 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats.accounts.length}</div>
          <div className="text-xs text-gray-400">Verbunden</div>
        </div>
        <div className="bg-surface-700 border border-surface-500 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{stats.scheduled.length}</div>
          <div className="text-xs text-gray-400">Geplant</div>
        </div>
      </div>

      {stats.jobs.length > 0 && (
        <div className="bg-surface-700 border border-surface-500 rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">
            Offene / Fehlgeschlagene Jobs
          </h3>
          <ul className="space-y-1 text-sm">
            {stats.jobs.slice(0, 5).map((job: any) => (
              <li key={job.id} className="flex justify-between">
                <span>{job.job_type}</span>
                <span
                  className={`text-xs ${
                    job.status === "failed" ? "text-red-400" : "text-yellow-400"
                  }`}
                >
                  {job.status}{" "}
                  {job.attempts > 0 && `(${job.attempts})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
