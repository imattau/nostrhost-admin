// Terminology convention for actions that take something away, so labels
// read the same across every view instead of drifting between "Remove",
// "Delete", "Revoke", and "Purge" for logically similar actions:
//
// - Revoke: taking back access/permission a principal holds (a group
//   permission, a capability grant, a linked identity). The grant can be
//   re-issued later.
// - Remove: deleting a configuration entry that isn't itself data (a domain
//   from the managed list, a DNS record, a stored credential, an
//   app-to-group mapping).
// - Delete: destroying data/an artifact, normally irreversible (a backup
//   archive, a user account, a group).
//
// "Purge" is retired — relabel existing call sites to Remove or Delete
// depending on which of the above actually describes what they do.
export const CONFIRM_VERB = {
  revoke: 'Revoke',
  remove: 'Remove',
  delete: 'Delete',
} as const

export type ConfirmVerb = keyof typeof CONFIRM_VERB
