import type { Metadata } from "next";
import { JOBS } from "@/data/jobs";
import { JobDetailScreen } from "@/components/modules/operations/jobs/detail/JobDetailScreen";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return JOBS.map((j) => ({ id: String(j.id) }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const job = JOBS.find((j) => String(j.id) === id);
  // Live jobs (Monday item ids) aren't in the sample list; the page finds them in the live data.
  if (!job) return { title: "Job" };
  return { title: job.jobNo ? `Job ${job.jobNo} · ${job.client}` : `New job · ${job.client}` };
}

export default async function Page({ params }: Params) {
  const { id } = await params;
  // Keyed so opening another job resets the page's drafts and editors.
  return <JobDetailScreen key={id} id={id} />;
}
