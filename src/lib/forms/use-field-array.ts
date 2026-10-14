'use client'

import { useState, useCallback, useId } from 'react'

export interface FieldArrayItem<T = unknown> {
  id: string
  value: T
}

export interface UseFieldArrayOptions<TItem> {
  name?: string
  initialValues?: TItem[]
  onValuesChange?: (values: TItem[]) => void
}

export function useFieldArray<TItem = Record<string, unknown>>(
  options: UseFieldArrayOptions<TItem> = {}
) {
  const baseId = useId()
  const [items, setItems] = useState<FieldArrayItem<TItem>[]>(() => {
    return (options.initialValues || []).map((val, idx) => ({
      id: `${baseId}-item-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      value: val,
    }))
  })

  const notifyChange = useCallback(
    (newItems: FieldArrayItem<TItem>[]) => {
      setItems(newItems)
      if (options.onValuesChange) {
        options.onValuesChange(newItems.map((i) => i.value))
      }
    },
    [options]
  )

  const append = useCallback(
    (value: TItem) => {
      const newItem: FieldArrayItem<TItem> = {
        id: `${baseId}-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        value,
      }
      notifyChange([...items, newItem])
    },
    [baseId, items, notifyChange]
  )

  const prepend = useCallback(
    (value: TItem) => {
      const newItem: FieldArrayItem<TItem> = {
        id: `${baseId}-item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        value,
      }
      notifyChange([newItem, ...items])
    },
    [baseId, items, notifyChange]
  )

  const remove = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) return
      const next = items.filter((_, idx) => idx !== index)
      notifyChange(next)
    },
    [items, notifyChange]
  )

  const update = useCallback(
    (index: number, value: TItem) => {
      if (index < 0 || index >= items.length) return
      const next = [...items]
      next[index] = { ...next[index], value }
      notifyChange(next)
    },
    [items, notifyChange]
  )

  const swap = useCallback(
    (from: number, to: number) => {
      if (from < 0 || from >= items.length || to < 0 || to >= items.length) return
      const next = [...items]
      const temp = next[from]
      next[from] = next[to]
      next[to] = temp
      notifyChange(next)
    },
    [items, notifyChange]
  )

  const move = useCallback(
    (from: number, to: number) => {
      if (from < 0 || from >= items.length || to < 0 || to >= items.length) return
      const next = [...items]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      notifyChange(next)
    },
    [items, notifyChange]
  )

  const replace = useCallback(
    (values: TItem[]) => {
      const next = values.map((val, idx) => ({
        id: `${baseId}-item-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        value: val,
      }))
      notifyChange(next)
    },
    [baseId, notifyChange]
  )

  return {
    fields: items,
    values: items.map((i) => i.value),
    append,
    prepend,
    remove,
    update,
    swap,
    move,
    replace,
  }
}
