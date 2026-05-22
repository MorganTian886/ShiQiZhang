import React, { useRef } from 'react'
import s from './LayerPanel.module.css'

const LAYER_ICONS = {
  background: '🌌',
  decoration: '✨',
  character: '🧍',
  text: '📝',
}

const LAYER_LABELS = {
  background: '背景',
  decoration: '装饰',
  character: '人物',
  text: '文字',
}

export default function LayerPanel({ layers, selectedId, onSelect, onChange, onAdd, onDelete, onReorder, onSwap }) {
  const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex)

  const moveUp = (id) => {
    const idx = sorted.findIndex(l => l.id === id)
    if (idx <= 0) return
    onSwap(sorted[idx].id, sorted[idx - 1].id)
  }

  const moveDown = (id) => {
    const idx = sorted.findIndex(l => l.id === id)
    if (idx >= sorted.length - 1) return
    onSwap(sorted[idx].id, sorted[idx + 1].id)
  }

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <span>图层</span>
        <div className={s.addBtns}>
          <button onClick={() => onAdd('background')} title="添加背景">＋背景</button>
          <button onClick={() => onAdd('decoration')} title="添加装饰">＋装饰</button>
          <button onClick={() => onAdd('character')} title="添加人物">＋人物</button>
          <button onClick={() => onAdd('text')} title="添加文字">＋文字</button>
        </div>
      </div>
      <div className={s.list}>
        {sorted.map(layer => (
          <div
            key={layer.id}
            className={`${s.item} ${selectedId === layer.id ? s.selected : ''}`}
            onClick={() => onSelect(layer.id)}
          >
            <span className={s.icon}>{LAYER_ICONS[layer.type]}</span>
            <span className={s.name}>{layer.name || LAYER_LABELS[layer.type]}</span>
            <div className={s.controls}>
              <button onClick={e => { e.stopPropagation(); moveUp(layer.id) }} title="上移">↑</button>
              <button onClick={e => { e.stopPropagation(); moveDown(layer.id) }} title="下移">↓</button>
              <button
                className={layer.visible ? s.visOn : s.visOff}
                onClick={e => { e.stopPropagation(); onChange(layer.id, { visible: !layer.visible }) }}
                title="显示/隐藏"
              >👁</button>
              <button
                className={s.del}
                onClick={e => { e.stopPropagation(); onDelete(layer.id) }}
                title="删除"
              >✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
