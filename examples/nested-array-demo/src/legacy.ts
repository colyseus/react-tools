/* eslint-disable @typescript-eslint/no-explicit-any */
import { Schema, Decoder, type DataChange } from "@colyseus/schema";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * A faithful re-implementation of the snapshot engine BEFORE the fix, kept here
 * purely so the demo can show the bug next to the fix. The single, deliberate
 * difference from the shipped code is marked "PRE-FIX BUG" below: the dirty set
 * is cleared at the START of every decode. When patches arrive with no snapshot
 * between them (e.g. the view is unmounted on a tab switch), a later decode wipes
 * an earlier decode's ancestor marks, and a cached nested subtree is then
 * short-circuited as "unchanged" and returned stale. (#10)
 */

const REF_ID_KEY = "~refId";
const fieldNamesByCtor = new WeakMap<Function, string[]>();

function getSchemaFieldNames(node: any): string[] {
  const ctor = node.constructor as Function;
  const cached = fieldNamesByCtor.get(ctor);
  if (cached) return cached;
  const metadata = (ctor as any)?.[Symbol.metadata];
  const names = metadata ? Object.values(metadata as any).map((f: any) => f.name) : [];
  fieldNamesByCtor.set(ctor, names);
  return names;
}

function getRefId(node: any): number {
  const r = node?.[REF_ID_KEY];
  return typeof r === "number" ? r : -1;
}

interface Ctx {
  resultsByRefId: Map<number, any>;
  visitedThisPass: Set<number>;
  dirtyRefIds: Set<number>;
  parentRefIdMap: Map<number, number>;
  currentParentRefId: number;
}

function snapshot(node: any, ctx: Ctx): any {
  if (node === null || node === undefined || typeof node !== "object") return node;

  const refId = getRefId(node);
  if (refId !== -1 && ctx.currentParentRefId !== -1) ctx.parentRefIdMap.set(refId, ctx.currentParentRefId);
  if (refId !== -1 && ctx.visitedThisPass.has(refId)) return ctx.resultsByRefId.get(refId);

  const previous = refId !== -1 ? ctx.resultsByRefId.get(refId) : undefined;

  // Short-circuit purely on the dirty set — correct only if every change since
  // the last snapshot is still marked. The PRE-FIX BUG (see below) breaks that.
  if (refId !== -1 && previous !== undefined && !ctx.dirtyRefIds.has(refId)) {
    ctx.visitedThisPass.add(refId);
    return previous;
  }

  const savedParent = ctx.currentParentRefId;
  ctx.currentParentRefId = refId;
  let result: any;

  if (typeof node.set === "function") { // MapSchema
    const out: Record<string, any> = {};
    let changed = previous === undefined;
    for (const [k, v] of node) {
      const sv = snapshot(v, ctx);
      out[k] = sv;
      if (!changed && previous && previous[k] !== sv) changed = true;
    }
    if (!changed && previous) {
      let count = 0;
      for (const _ in previous) count++;
      if (count !== node.size) changed = true;
    }
    result = changed ? out : previous;
  } else if (typeof node.push === "function") { // ArraySchema
    const len = node.length;
    let changed = !previous || !Array.isArray(previous) || len !== previous.length;
    const out = new Array(len);
    for (let i = 0; i < len; i++) {
      const sv = snapshot(node.at(i), ctx);
      out[i] = sv;
      if (!changed && previous && previous[i] !== sv) changed = true;
    }
    result = changed ? out : previous;
  } else if (Schema.isSchema(node)) {
    const out: Record<string, any> = {};
    let changed = previous === undefined;
    for (const f of getSchemaFieldNames(node)) {
      const v = node[f];
      if (typeof v === "function") continue;
      const sv = snapshot(v, ctx);
      out[f] = sv;
      if (!changed && previous && previous[f] !== sv) changed = true;
    }
    result = changed ? out : previous;
  } else {
    result = node;
  }

  ctx.currentParentRefId = savedParent;
  if (refId !== -1) {
    ctx.resultsByRefId.set(refId, result);
    ctx.visitedThisPass.add(refId);
  }
  return result;
}

interface Sub {
  listeners: Set<() => void>;
  resultsByRefId: Map<number, any>;
  visitedThisPass: Set<number>;
  dirtyRefIds: Set<number>;
  parentRefIdMap: Map<number, number>;
  originalDecode: any;
}

const subs = new WeakMap<Schema, Sub>();

function getOrCreateSub(state: Schema, decoder: Decoder): Sub {
  const existing = subs.get(state);
  if (existing) return existing;

  const sub: Sub = {
    listeners: new Set(),
    resultsByRefId: new Map(),
    visitedThisPass: new Set(),
    dirtyRefIds: new Set(),
    parentRefIdMap: new Map(),
    originalDecode: decoder.decode,
  };

  decoder.decode = function (this: Decoder, ...args: any[]) {
    // ── PRE-FIX BUG ───────────────────────────────────────────────────────
    // Clear the dirty set at the START of every decode. A second decode that
    // arrives before a snapshot consumes the first one wipes the first's marks.
    sub.dirtyRefIds.clear();
    // ──────────────────────────────────────────────────────────────────────

    const changes: DataChange[] = sub.originalDecode.apply(decoder, args);
    if (changes && changes.length > 0) {
      const dirty = sub.dirtyRefIds;
      const parents = sub.parentRefIdMap;
      for (const change of changes) {
        let cur: number | undefined = (change as any).refId;
        while (cur !== undefined && !dirty.has(cur)) {
          dirty.add(cur);
          cur = parents.get(cur);
        }
      }
      sub.listeners.forEach((cb) => cb());
    }
    return changes;
  };

  subs.set(state, sub);
  return sub;
}

/** Same shape as the library's `useColyseusState`, but with the pre-fix engine. */
export function useLegacyColyseusState<T extends Schema, U>(
  state: T | undefined,
  decoder: Decoder<T> | undefined,
  selector: (s: T) => U,
): U | undefined {
  useEffect(() => {
    if (state && decoder) getOrCreateSub(state, decoder);
  }, [state, decoder]);

  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const getSnapshot = useCallback(() => {
    if (!state || !decoder) return undefined;
    const sub = getOrCreateSub(state, decoder);
    const selected = selectorRef.current(state);
    sub.visitedThisPass.clear();
    return snapshot(selected, {
      resultsByRefId: sub.resultsByRefId,
      visitedThisPass: sub.visitedThisPass,
      dirtyRefIds: sub.dirtyRefIds,
      parentRefIdMap: sub.parentRefIdMap,
      currentParentRefId: -1,
    });
  }, [state, decoder]);

  const subscribe = useCallback((cb: () => void) => {
    if (!state || !decoder) return () => {};
    const sub = getOrCreateSub(state, decoder);
    sub.listeners.add(cb);
    return () => sub.listeners.delete(cb);
  }, [state, decoder]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
