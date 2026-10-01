"use client";

import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { RateBar } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { ONBOARDING, OPEN_ROLES, personTone } from "../data";

/** HR › Recruitment — open roles with their candidate funnel, and the onboarding in flight. */
export function HrRecruitmentTab() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recruitment"
        description="Open positions and candidate pipeline · onboarding tasks tracked per hire."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {OPEN_ROLES.map((role, i) => (
          <Reveal key={role.role} index={i}>
            <Card className="h-full">
              <CardHeader className="pb-0">
                <CardTitle as="h3">{role.role}</CardTitle>
                <CardDescription className="mt-0.5">Hiring manager: {role.manager}</CardDescription>
              </CardHeader>
              <CardContent className="pt-3">
                <dl className="grid grid-cols-3 gap-2">
                  {role.stages.map((s) => (
                    <div key={s.label} className="flex flex-col-reverse items-center rounded-lg bg-muted px-2.5 py-2.5 text-center">
                      <dt className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        {s.label}
                      </dt>
                      <dd className="text-lg leading-tight font-bold tabular-nums">
                        <CountUp value={s.count} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>

      <Reveal index={2}>
        <Card>
          <CardHeader>
            <CardTitle>Onboarding in progress</CardTitle>
            <CardMeta>1 new starter</CardMeta>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
              <Avatar name={ONBOARDING.name} tone={personTone(ONBOARDING.name)} size="sm" />
              <span className="font-semibold">{ONBOARDING.name}</span>
              <span className="text-xs text-muted-foreground">{ONBOARDING.detail}</span>
              <span className="ml-auto text-xs font-semibold text-tone-ink tabular-nums">
                {ONBOARDING.done} of {ONBOARDING.total} tasks done
              </span>
            </div>
            <RateBar
              value={ONBOARDING.done / ONBOARDING.total}
              tone="tone"
              height="h-[7px]"
              className="mt-2.5"
              label={`${ONBOARDING.done} of ${ONBOARDING.total} onboarding tasks done`}
            />
            <p className="mt-2 text-xs text-subtle-foreground">{ONBOARDING.remaining}</p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
