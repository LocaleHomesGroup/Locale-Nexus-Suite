"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { useTabParam } from "@/hooks/useTabParam";
import { useNavReselect } from "@/components/shell/nav-state";
import { PageHeader } from "@/components/ui/page";
import { Pill } from "@/components/ui/pill";
import { TabPanels } from "@/components/ui/sliding-tabs";
import {
  REVIEW_AT,
  SEED_FIELDS,
  STEP_AT,
  TEMPLATE_LIBRARY,
  VIEW_ORDER,
  type ExtractedField,
  type FormatterView,
} from "./data";
import { UploadStep, type PickedFile } from "./UploadStep";
import { ProcessingStep } from "./ProcessingStep";
import { ExtractionReview } from "./ExtractionReview";
import { PriceChanges } from "./PriceChanges";
import { FormatterJobs } from "./FormatterJobs";
import { TemplateLibrary } from "./TemplateLibrary";

type SubTab = "upload" | "changes" | "jobs" | "templates";

/** The four views, in `?view=` — listed under Doc formatter in the Operations rail. */
const SUB_TABS: readonly SubTab[] = ["upload", "changes", "jobs", "templates"];

/**
 * Operations → Doc formatter (mockup `dm`, with `sm` as the Price changes view).
 *
 * New job walks upload → processing → review: pick a file and an output
 * template, watch the (simulated) extraction, then check only the fields the
 * app was unsure of. Confirming hands over to Price changes, where the list is
 * compared against last month, the change report goes to Sean and the list is
 * published to Pricing.
 *
 * Everything here is module-private state — it lives as long as this tab does.
 */
export function DocFormatter() {
  const { notify } = useLaunchpad();

  const [view, setViewState] = React.useState<FormatterView>("upload");
  const viewRef = React.useRef<FormatterView>("upload");
  const dirRef = React.useRef(0);

  const [file, setFile] = React.useState<PickedFile | null>(null);
  const [template, setTemplate] = React.useState("");
  const [step, setStep] = React.useState(0);
  const [fields, setFields] = React.useState<ExtractedField[]>(SEED_FIELDS);
  const [downloaded, setDownloaded] = React.useState(false);
  const [reportSent, setReportSent] = React.useState(false);
  const [published, setPublished] = React.useState(false);
  const [library, setLibrary] = React.useState(TEMPLATE_LIBRARY);

  // The simulated extraction's timers — cancelled if you leave mid-run, so a
  // late tick never yanks you back to the review screen.
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = React.useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  React.useEffect(() => clearTimers, [clearTimers]);

  const setView = React.useCallback((next: FormatterView) => {
    dirRef.current = Math.sign(VIEW_ORDER.indexOf(next) - VIEW_ORDER.indexOf(viewRef.current));
    viewRef.current = next;
    setViewState(next);
  }, []);

  const start = () => {
    clearTimers();
    setView("processing");
    setStep(0);
    STEP_AT.forEach((ms, i) => timers.current.push(setTimeout(() => setStep(i + 1), ms)));
    timers.current.push(setTimeout(() => setView("review"), REVIEW_AT));
  };

  // Which of the four views the URL (the rail) is showing.
  const [sub, setSub] = useTabParam(SUB_TABS, "upload", "view");

  const finish = () => {
    setDownloaded(true);
    setView("changes");
    setSub("changes"); // the rail follows the flow onto Price changes
    const msg = "Formatted price list ready · review price changes";
    notify(msg, "ok");
    confirm(msg);
  };

  const onSubTab = React.useCallback(
    (next: SubTab) => {
      clearTimers();
      if (next !== viewRef.current) setView(next);
    },
    [clearTimers, setView],
  );

  const subTab: SubTab = view === "processing" || view === "review" ? "upload" : (view as SubTab);

  // A rail click (or back/forward) changed ?view= — follow it. Processing and
  // review belong to New job, so landing on "upload" mid-extraction keeps you there.
  React.useEffect(() => {
    if (sub !== subTab) onSubTab(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  // Re-clicking "New job" in the rail mid-extraction starts a fresh job.
  useNavReselect("operations:formatter:upload", () => onSubTab("upload"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Doc formatter"
        description="Upload a raw price list or data export and choose the template to format it into. Every extracted value is scored, so you only check what the app was unsure about."
        actions={
          <Pill tone="neutral" icon={FileText}>
            Pricing and data extraction
          </Pill>
        }
      />

      <TabPanels value={view} dir={dirRef.current} variant="slide">
        {view === "upload" ? (
          <UploadStep file={file} setFile={setFile} template={template} setTemplate={setTemplate} onStart={start} />
        ) : view === "processing" ? (
          <ProcessingStep step={step} />
        ) : view === "review" ? (
          <ExtractionReview
            file={file}
            template={template}
            fields={fields}
            setFields={setFields}
            downloaded={downloaded}
            onRerun={start}
            onConfirm={finish}
          />
        ) : view === "changes" ? (
          <PriceChanges
            reportSent={reportSent}
            setReportSent={setReportSent}
            published={published}
            setPublished={setPublished}
          />
        ) : view === "jobs" ? (
          <FormatterJobs />
        ) : (
          <TemplateLibrary library={library} setLibrary={setLibrary} />
        )}
      </TabPanels>
    </div>
  );
}
