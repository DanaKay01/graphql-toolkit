import { loadTypedefs, DocumentFile, LoadTypedefsOptions } from './load-typedefs';
import { Kind } from 'graphql/language/kinds';

export const OPERATION_KINDS = [Kind.OPERATION_DEFINITION, Kind.FRAGMENT_DEFINITION];
export const NON_OPERATION_KINDS = Object.keys(Kind).reduce((prev, v) => [...prev, Kind[v]], []).filter(v => !OPERATION_KINDS.includes(v));

export async function loadDocuments (documentDef: string, options: LoadTypedefsOptions = {}, cwd = process.cwd()): Promise<DocumentFile[]> {
  return await loadTypedefs(documentDef, options, NON_OPERATION_KINDS, cwd);
};
