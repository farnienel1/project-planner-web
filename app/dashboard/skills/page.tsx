'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { SkillTradeAutocomplete } from '@/components/skills/SkillTradeAutocomplete'
import {
  buildSkillTradeSuggestions,
  displaySkillTrade,
  isDuplicateSkill,
} from '@/lib/staff/skillUtils'
import type { Skill } from '@/types'
import { collection, addDoc, deleteDoc, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export default function SkillsPage() {
  const { organization, user } = useAuthStore()
  const { skills, loading, loadSkills } = useOperativeStore()
  const [name, setName] = useState('')
  const [trade, setTrade] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [editName, setEditName] = useState('')
  const [editTrade, setEditTrade] = useState('')
  const canManage = user?.permissions?.skills || user?.isSuperAdmin

  const tradeSuggestions = useMemo(() => buildSkillTradeSuggestions(skills), [skills])

  useEffect(() => {
    if (organization?.id) {
      loadSkills(organization.id)
    }
  }, [organization, loadSkills])

  const resetAddForm = () => {
    setName('')
    setTrade('')
    setError(null)
  }

  const startEdit = (skill: Skill) => {
    if (!canManage) return
    setEditingSkill(skill)
    setEditName(skill.name)
    setEditTrade(skill.trade?.trim() || '')
    setError(null)
  }

  const cancelEdit = () => {
    setEditingSkill(null)
    setEditName('')
    setEditTrade('')
    setError(null)
  }

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!organization?.id || !canManage) return

    const trimmedName = name.trim()
    const trimmedTrade = trade.trim()
    if (!trimmedName || !trimmedTrade) {
      setError('Skill name and trade are required.')
      return
    }
    if (isDuplicateSkill(skills, trimmedName, trimmedTrade)) {
      setError('This skill already exists for that trade.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await addDoc(collection(db, 'organizations', organization.id, 'skills'), {
        name: trimmedName,
        trade: trimmedTrade,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      resetAddForm()
      await loadSkills(organization.id)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!organization?.id || !canManage || !editingSkill) return

    const trimmedName = editName.trim()
    const trimmedTrade = editTrade.trim()
    if (!trimmedName || !trimmedTrade) {
      setError('Skill name and trade are required.')
      return
    }
    if (isDuplicateSkill(skills, trimmedName, trimmedTrade, editingSkill.id)) {
      setError('This skill already exists for that trade.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateDoc(doc(db, 'organizations', organization.id, 'skills', editingSkill.id), {
        name: trimmedName,
        trade: trimmedTrade,
        updatedAt: Timestamp.now(),
      })
      cancelEdit()
      await loadSkills(organization.id)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!organization?.id || !canManage) return
    if (!window.confirm('Delete this skill?')) return
    if (editingSkill?.id === id) cancelEdit()
    await deleteDoc(doc(db, 'organizations', organization.id, 'skills', id))
    await loadSkills(organization.id)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h1 className="text-3xl font-bold text-slate-900">Skills</h1>
        <p className="mt-1 text-slate-600">
          Group skills by trade for your catalogue. Skills can be assigned to any operative regardless of their trade.
        </p>
      </div>

      {canManage && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Skill name"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
              required
            />
            <SkillTradeAutocomplete
              value={trade}
              onChange={setTrade}
              trades={tradeSuggestions}
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Add skill
            </button>
          </div>
          {error && !editingSkill && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      {editingSkill && canManage && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <p className="text-sm font-semibold text-slate-900">Edit skill</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Skill name"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
            <SkillTradeAutocomplete
              value={editTrade}
              onChange={setEditTrade}
              trades={tradeSuggestions}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Skill</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">Trade</th>
              {canManage && <th className="px-6 py-3 text-right text-xs font-medium uppercase text-slate-500">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {skills.map((skill) => {
              const isEditing = editingSkill?.id === skill.id
              return (
                <tr
                  key={skill.id}
                  className={`${canManage ? 'cursor-pointer hover:bg-slate-50' : ''} ${isEditing ? 'bg-blue-50/50' : ''}`}
                  onClick={() => startEdit(skill)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{skill.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{displaySkillTrade(skill.trade)}</td>
                  {canManage && (
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(skill.id)
                        }}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
