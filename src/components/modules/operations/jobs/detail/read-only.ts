"use client";

import * as React from "react";

/**
 * True on a live job's page. That page switches its left column off (a disabled fieldset), and the
 * cards read this to say so: "Monday owns · read only" in place of "Launchpad owns · editable", and no
 * accent rim. Inputs and chips need no flag: inside the disabled fieldset they match `:disabled` and
 * style themselves.
 */
export const JobReadOnly = React.createContext(false);

export const useJobReadOnly = (): boolean => React.useContext(JobReadOnly);
