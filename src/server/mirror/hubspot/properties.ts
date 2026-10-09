/**
 * What the mirror reads from each HubSpot object. Property names are HubSpot's
 * internal names. A search body must stay under 3,000 characters, so the lists
 * are short; add to them as screens need more. Deals include Jerry's job fields
 * (builder, builder_job_no, ...), so his Dash Sync could later read them from here.
 */
export const OBJECTS = ["deals", "contacts", "meetings", "notes"] as const;
export type HubSpotObject = (typeof OBJECTS)[number];

/** The last-modified property each object's search filters and sorts on. */
export const MODIFIED: Record<HubSpotObject, string> = {
  deals: "hs_lastmodifieddate",
  contacts: "lastmodifieddate",
  meetings: "hs_lastmodifieddate",
  notes: "hs_lastmodifieddate",
};

export const PROPERTIES: Record<HubSpotObject, string[]> = {
  deals: [
    "dealname", "pipeline", "dealstage", "hubspot_owner_id", "amount", "closedate", "createdate",
    "hs_lastmodifieddate", "hs_priority", "hs_next_step", "builder", "builder_job_no", "street_address",
    "site_suburb", "site_state", "buyer_type", "block_titled_", "expected_title_date", "finance_type",
    "house_type", "developer", "broker", "land_price", "package_price", "total_updown",
  ],
  contacts: [
    "firstname", "lastname", "email", "phone", "mobilephone", "address", "city", "state", "zip",
    "hubspot_owner_id", "lifecyclestage", "hs_lead_status", "createdate", "lastmodifieddate",
  ],
  meetings: [
    "hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome",
    "hs_timestamp", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate",
  ],
  notes: ["hs_note_body", "hs_timestamp", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate"],
};
