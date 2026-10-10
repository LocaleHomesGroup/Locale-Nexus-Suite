/**
 * Every GraphQL document the mirror sends. All of them are queries: the client
 * refuses anything else. Multi-board queries set `limit`, because Monday's
 * `boards` returns 25 by default. Column values ask only for fragments known to
 * exist in 2026-10; file assets are read from a file column's raw `value`.
 */
const COLUMN_VALUES = `column_values {
  id type text value
  ... on StatusValue { index label }
  ... on DateValue { date }
  ... on BoardRelationValue { linked_item_ids display_value }
  ... on MirrorValue { display_value }
}`;

export const ITEM_FIELDS = `id name state created_at updated_at creator_id group { id } board { id name } parent_item { id } ${COLUMN_VALUES}`;

const UPDATE_FIELDS = "id item_id body text_body created_at updated_at creator_id assets { id name }";

const BOARD_FIELDS = "id name type state updated_at workspace { id } columns { id title type } groups { id title color position archived deleted }";

export const Q = {
  workspaces: "query { workspaces(limit: 100) { id name kind } }",
  boardsInWorkspaces: `query ($ws: [ID!], $page: Int!) { boards(workspace_ids: $ws, limit: 100, page: $page, state: all) { ${BOARD_FIELDS} } }`,
  boardsById: `query ($ids: [ID!]) { boards(ids: $ids, limit: 100, state: all) { ${BOARD_FIELDS} } }`,
  // API 2026-10's User has no `enabled` or `is_guest` (Monday rejects them): discover.ts derives both from these.
  users: "query ($page: Int!) { users(limit: 200, page: $page) { id name email kind status is_deleted } }",
  firstItemsPage: `query ($board: [ID!], $limit: Int!) { boards(ids: $board) { items_page(limit: $limit) { cursor items { ${ITEM_FIELDS} } } } }`,
  nextItemsPage: `query ($cursor: String!, $limit: Int!) { next_items_page(cursor: $cursor, limit: $limit) { cursor items { ${ITEM_FIELDS} } } }`,
  firstStampsPage: "query ($board: [ID!], $limit: Int!) { boards(ids: $board) { items_page(limit: $limit) { cursor items { id updated_at } } } }",
  nextStampsPage: "query ($cursor: String!, $limit: Int!) { next_items_page(cursor: $cursor, limit: $limit) { cursor items { id updated_at } } }",
  recentStampsPage: `query ($board: [ID!], $limit: Int!) { boards(ids: $board) { items_page(limit: $limit, query_params: { rules: [{ column_id: "__last_updated__", compare_value: ["TODAY", "YESTERDAY"], compare_attribute: "UPDATED_AT", operator: any_of }] }) { cursor items { id updated_at } } } }`,
  itemsByIds: `query ($ids: [ID!], $limit: Int!) { items(ids: $ids, limit: $limit, exclude_nonactive: false) { ${ITEM_FIELDS} } }`,
  boardUpdatesPage: `query ($board: [ID!], $limit: Int!, $page: Int!) { boards(ids: $board) { updates(limit: $limit, page: $page) { ${UPDATE_FIELDS} } } }`,
  activityWithUpdates: `query ($boards: [ID!], $from: ISO8601DateTime!, $limit: Int!) { boards(ids: $boards, limit: 100) { id activity_logs(from: $from, limit: $limit, page: 1) { id event entity data created_at } updates(limit: 25) { ${UPDATE_FIELDS} } } }`,
  activityPage: "query ($boards: [ID!], $from: ISO8601DateTime!, $limit: Int!, $page: Int!) { boards(ids: $boards, limit: 100) { id activity_logs(from: $from, limit: $limit, page: $page) { id event entity data created_at } } }",
  assets: "query ($ids: [ID!]!) { assets(ids: $ids) { id name file_extension file_size public_url created_at } }",
} as const;
