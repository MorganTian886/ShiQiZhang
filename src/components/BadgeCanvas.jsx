import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

const PADDING = 24
const HANDLE_R = 7
const ROT_OFFSET = 30

// ─── 工具函数 ───
function hexPoints(cx, cy, rx, ry, rot = -Math.PI / 6) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + rot
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]
  })
}
function tracePath(ctx, pts) {
  ctx.beginPath()
  pts.forEach(([x,y],i) => i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y))
  ctx.closePath()
}
function drawRing(ctx, cx, cy, oRx, oRy, iRx, iRy, rot, color) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath()
  hexPoints(cx,cy,oRx,oRy,rot).forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
  hexPoints(cx,cy,iRx,iRy,rot).slice().reverse().forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
  ctx.fill('evenodd'); ctx.restore()
}
function safeR(v) { return Math.max(2, v||2) }
function mulberry32(seed) {
  let a=seed; return ()=>{ a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296 }
}
function hexToRgb(h){
  try{return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
  catch{return[128,128,128]}
}
function hexToRgba(h,a){try{const[r,g,b]=hexToRgb(h);return`rgba(${r},${g},${b},${a})`}catch{return`rgba(128,128,128,${a})`}}
function blendHex(c1,c2,t){try{const[r1,g1,b1]=hexToRgb(c1),[r2,g2,b2]=hexToRgb(c2);return`rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`}catch{return c1}}
function getRxRy(hexW,hexH){return{rx:safeR(hexW/Math.sqrt(3)),ry:safeR(hexH/2)}}

function canvasPt(e, canvas) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) * (canvas.width  / rect.width),
    y: (e.clientY - rect.top)  * (canvas.height / rect.height),
  }
}

// 通用：获取图层控制手柄（文字和装饰共用）
function getHandles(layer, defaultX, defaultY) {
  const x   = layer.shapeX ?? layer.textX ?? defaultX
  const y   = layer.shapeY ?? layer.textY ?? defaultY
  const w   = layer.shapeW ?? layer.textW ?? 200
  const h   = layer.shapeH ?? layer.textH ?? 200
  const rot = layer.shapeRot ?? layer.textRot ?? 0
  const hw=w/2, hh=h/2
  const cos=Math.cos(rot), sin=Math.sin(rot)
  const rotate=([lx,ly])=>[x+lx*cos-ly*sin, y+lx*sin+ly*cos]
  const handles=[[-hw,-hh],[0,-hh],[hw,-hh],[hw,0],[hw,hh],[0,hh],[-hw,hh],[-hw,0]].map(rotate)
  const rotHandle = rotate([0,-hh-ROT_OFFSET])
  return { handles, rotHandle, x, y, w, h, rot }
}

function hitHandle(pt, handles, rotHandle) {
  for(let i=0;i<handles.length;i++){
    const[hx,hy]=handles[i]
    if(Math.hypot(pt.x-hx,pt.y-hy)<HANDLE_R+5) return{type:'scale',idx:i}
  }
  if(Math.hypot(pt.x-rotHandle[0],pt.y-rotHandle[1])<HANDLE_R+6) return{type:'rotate'}
  return null
}

function ptInBox(pt, layer, defaultX, defaultY) {
  const x=layer.shapeX??layer.textX??defaultX, y=layer.shapeY??layer.textY??defaultY
  const w=layer.shapeW??layer.textW??200, h=layer.shapeH??layer.textH??200
  const rot=layer.shapeRot??layer.textRot??0
  const cos=Math.cos(-rot),sin=Math.sin(-rot)
  const dx=pt.x-x, dy=pt.y-y
  const lx=dx*cos-dy*sin, ly=dx*sin+dy*cos
  return Math.abs(lx)<=w/2+6 && Math.abs(ly)<=h/2+6
}

// ─── 绘制几何图形 ───
function drawShape(ctx, layer, isSelected, defaultX=0, defaultY=0) {
  const x   = layer.shapeX ?? defaultX
  const y   = layer.shapeY ?? defaultY
  const w   = layer.shapeW ?? 200
  const h   = layer.shapeH ?? 200
  const rot = layer.shapeRot ?? 0
  const fill    = layer.shapeFill ?? '#c8a96e'
  const stroke  = layer.shapeStroke ?? 'transparent'
  const lw      = layer.shapeLineW ?? 2
  const filled  = layer.shapeFilled !== false

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.globalAlpha = layer.opacity ?? 1

  const hw=w/2, hh=h/2

  // 图片类型单独处理
  if (layer.decorType === 'image' && layer.image) {
    const img = layer.image
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const sc = Math.min(w / img.naturalWidth, h / img.naturalHeight)
      const iw = img.naturalWidth * sc, ih = img.naturalHeight * sc
      const ix = -iw / 2, iy = -ih / 2

      if (layer.iconColor && layer.iconColor !== 'original') {
        // 像素级颜色替换：保留原始 alpha，只替换 RGB
        const off = document.createElement('canvas')
        off.width = img.naturalWidth || 256
        off.height = img.naturalHeight || 256
        const oc = off.getContext('2d')
        oc.drawImage(img, 0, 0)

        const hex = layer.iconColor.replace('#','')
        const tR = parseInt(hex.slice(0,2),16)
        const tG = parseInt(hex.slice(2,4),16)
        const tB = parseInt(hex.slice(4,6),16)
        const op = layer.iconColorOpacity ?? 1

        const imgData = oc.getImageData(0, 0, off.width, off.height)
        const d = imgData.data
        for (let i = 0; i < d.length; i += 4) {
          if (d[i+3] > 0) {  // 只处理不透明像素
            d[i]   = Math.round(d[i]   * (1-op) + tR * op)
            d[i+1] = Math.round(d[i+1] * (1-op) + tG * op)
            d[i+2] = Math.round(d[i+2] * (1-op) + tB * op)
            // alpha 不动，保留原始边缘抗锯齿
          }
        }
        oc.putImageData(imgData, 0, 0)
        ctx.drawImage(off, ix, iy, iw, ih)
      } else {
        ctx.drawImage(img, ix, iy, iw, ih)
      }
    }
    if (isSelected) {
      ctx.strokeStyle='rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.setLineDash([5,4])
      ctx.strokeRect(-hw,-hh,w,h);ctx.setLineDash([])
      ctx.strokeStyle='rgba(100,180,255,0.6)';ctx.lineWidth=1.5
      ctx.beginPath();ctx.moveTo(0,-hh);ctx.lineTo(0,-hh-ROT_OFFSET);ctx.stroke()
      const dH=(lx,ly,isR)=>{ctx.beginPath();ctx.arc(lx,ly,HANDLE_R,0,Math.PI*2);ctx.fillStyle=isR?'#ffd700':'white';ctx.fill();ctx.strokeStyle=isR?'#c8a000':'rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.stroke()}
      ;[[-hw,-hh],[0,-hh],[hw,-hh],[hw,0],[hw,hh],[0,hh],[-hw,hh],[-hw,0]].forEach(([lx,ly])=>dH(lx,ly,false))
      dH(0,-hh-ROT_OFFSET,true)
    }
    ctx.restore()
    return
  }

  ctx.beginPath()
  switch(layer.decorType) {
    case 'rect':
      ctx.rect(-hw,-hh,w,h); break
    case 'round_rect':
      { const r=Math.min(hw,hh)*0.2
        ctx.moveTo(-hw+r,-hh); ctx.lineTo(hw-r,-hh)
        ctx.arcTo(hw,-hh,hw,-hh+r,r); ctx.lineTo(hw,hh-r)
        ctx.arcTo(hw,hh,hw-r,hh,r); ctx.lineTo(-hw+r,hh)
        ctx.arcTo(-hw,hh,-hw,hh-r,r); ctx.lineTo(-hw,-hh+r)
        ctx.arcTo(-hw,-hh,-hw+r,-hh,r); ctx.closePath()
      } break
    case 'circle':
      ctx.ellipse(0,0,hw,hh,0,0,Math.PI*2); break
    case 'triangle':
      ctx.moveTo(0,-hh); ctx.lineTo(hw,hh); ctx.lineTo(-hw,hh); ctx.closePath(); break
    case 'diamond':
      ctx.moveTo(0,-hh); ctx.lineTo(hw,0); ctx.lineTo(0,hh); ctx.lineTo(-hw,0); ctx.closePath(); break
    case 'hexagon':
      for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6;i===0?ctx.moveTo(hw*Math.cos(a),hh*Math.sin(a)):ctx.lineTo(hw*Math.cos(a),hh*Math.sin(a))}
      ctx.closePath(); break
    case 'star5':
      { const or=Math.min(hw,hh), ir=or*0.42
        for(let i=0;i<10;i++){const a=Math.PI/5*i-Math.PI/2,r=i%2===0?or:ir;i===0?ctx.moveTo(r*Math.cos(a),r*Math.sin(a)):ctx.lineTo(r*Math.cos(a),r*Math.sin(a))}
        ctx.closePath()
      } break
    case 'star6':
      { const or=Math.min(hw,hh), ir=or*0.5
        for(let i=0;i<12;i++){const a=Math.PI/6*i-Math.PI/2,r=i%2===0?or:ir;i===0?ctx.moveTo(r*Math.cos(a),r*Math.sin(a)):ctx.lineTo(r*Math.cos(a),r*Math.sin(a))}
        ctx.closePath()
      } break
    case 'cross':
      { const t=Math.min(hw,hh)*0.35
        ctx.moveTo(-t,-hh);ctx.lineTo(t,-hh);ctx.lineTo(t,-t);ctx.lineTo(hw,-t);ctx.lineTo(hw,t)
        ctx.lineTo(t,t);ctx.lineTo(t,hh);ctx.lineTo(-t,hh);ctx.lineTo(-t,t);ctx.lineTo(-hw,t)
        ctx.lineTo(-hw,-t);ctx.lineTo(-t,-t);ctx.closePath()
      } break
    case 'arrow':
      { const aw=hw*0.5
        ctx.moveTo(-hw,hh*0.35);ctx.lineTo(-hw,-hh*0.35);ctx.lineTo(aw*0.5,-hh*0.35)
        ctx.lineTo(aw*0.5,-hh);ctx.lineTo(hw,0);ctx.lineTo(aw*0.5,hh)
        ctx.lineTo(aw*0.5,hh*0.35);ctx.closePath()
      } break
    case 'line':
      ctx.moveTo(-hw,0); ctx.lineTo(hw,0); break
    case 'shield':
      ctx.moveTo(0,-hh); ctx.lineTo(hw,-hh*0.5); ctx.lineTo(hw,hh*0.1)
      ctx.quadraticCurveTo(hw,hh,0,hh*1.0); ctx.quadraticCurveTo(-hw,hh,-hw,hh*0.1)
      ctx.lineTo(-hw,-hh*0.5); ctx.closePath(); break
    case 'moon':
      ctx.arc(0,0,Math.min(hw,hh),Math.PI*0.4,Math.PI*1.6)
      ctx.arc(-Math.min(hw,hh)*0.3,0,Math.min(hw,hh)*0.8,Math.PI*1.6,Math.PI*0.4,true)
      ctx.closePath(); break
    default:
      ctx.ellipse(0,0,hw,hh,0,0,Math.PI*2); break
  }

  if(layer.decorType==='line'){
    ctx.strokeStyle=fill; ctx.lineWidth=lw*2||4; ctx.stroke()
  } else {
    if(filled){ ctx.fillStyle=fill; ctx.fill() }
    if(stroke!=='transparent'){ ctx.strokeStyle=stroke; ctx.lineWidth=lw; ctx.stroke() }
    if(!filled){ ctx.strokeStyle=fill; ctx.lineWidth=lw||3; ctx.stroke() }
  }

  // 选中控制框
  if(isSelected){
    ctx.strokeStyle='rgba(100,180,255,0.9)'; ctx.lineWidth=2; ctx.setLineDash([5,4])
    ctx.strokeRect(-hw,-hh,w,h); ctx.setLineDash([])
    ctx.strokeStyle='rgba(100,180,255,0.6)'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.moveTo(0,-hh); ctx.lineTo(0,-hh-ROT_OFFSET); ctx.stroke()
    const drawH=(lx,ly,isRot)=>{
      ctx.beginPath(); ctx.arc(lx,ly,HANDLE_R,0,Math.PI*2)
      ctx.fillStyle=isRot?'#ffd700':'white'; ctx.fill()
      ctx.strokeStyle=isRot?'#c8a000':'rgba(100,180,255,0.9)'; ctx.lineWidth=2; ctx.stroke()
    }
    ;[[-hw,-hh],[0,-hh],[hw,-hh],[hw,0],[hw,hh],[0,hh],[-hw,hh],[-hw,0]].forEach(([lx,ly])=>drawH(lx,ly,false))
    drawH(0,-hh-ROT_OFFSET,true)
  }
  ctx.restore()
}

// ─── 边框纹路 ───
function drawBorderPattern(ctx, cx, cy, R1, R2, rot, config) {
  const color = config.borderPatternColor ?? 'rgba(0,0,0,0.35)'
  const opacity = config.borderPatternOpacity ?? 0.7
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.fillStyle = color

  // 获取gap中线的六边形顶点
  const midRx = (R1.rx + R2.rx) / 2, midRy = (R1.ry + R2.ry) / 2
  const gapW = R1.rx - R2.rx  // gap宽度
  const pts1 = hexPoints(cx, cy, R1.rx, R1.ry, rot)  // 外边
  const pts2 = hexPoints(cx, cy, R2.rx, R2.ry, rot)  // 内边
  const ptsMid = hexPoints(cx, cy, midRx, midRy, rot) // 中线

  // 沿六边形6条边采样插值
  function samplePerimeter(R, totalSamples) {
    const pts = hexPoints(cx, cy, R.rx, R.ry, rot)
    const result = []
    for (let s = 0; s < 6; s++) {
      const [ax, ay] = pts[s], [bx, by] = pts[(s+1)%6]
      const segs = Math.floor(totalSamples / 6)
      for (let i = 0; i < segs; i++) {
        const t = i / segs
        result.push({ x: ax+(bx-ax)*t, y: ay+(by-ay)*t, side: s, t })
      }
    }
    return result
  }

  // 法线方向（每条边向内）
  function sideNormal(s, inward=true) {
    const pts = hexPoints(cx, cy, 1, 1, rot)
    const [ax,ay]=pts[s],[bx,by]=pts[(s+1)%6]
    const dx=bx-ax, dy=by-ay, len=Math.hypot(dx,dy)
    const nx=-dy/len, ny=dx/len // 左法线（指向六边形内侧）
    return inward ? [nx,ny] : [-nx,-ny]
  }

  switch(config.borderPattern) {

    case 'ticks': {
      // 刻度线纹：外边密集小刻度+内边大刻度，精密仪器感
      ctx.lineWidth = 0.8
      const samples = samplePerimeter(R2, 360)
      samples.forEach(({x, y, side, t}, i) => {
        const [nx, ny] = sideNormal(side)
        const isMajor = i % 5 === 0
        const tickLen = isMajor ? gapW * 0.55 : gapW * 0.28
        ctx.beginPath()
        ctx.moveTo(x - nx*gapW*0.1, y - ny*gapW*0.1)
        ctx.lineTo(x - nx*gapW*0.1 + nx*tickLen, y - ny*gapW*0.1 + ny*tickLen)
        ctx.lineWidth = isMajor ? 1.2 : 0.6
        ctx.stroke()
      })
      // 中间细线
      ctx.lineWidth = 0.5; ctx.globalAlpha = opacity * 0.4
      ctx.beginPath()
      ptsMid.forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath(); ctx.stroke()
      break
    }

    case 'circuit': {
      // 电路板走线纹：90°折角走线+焊点
      const rng = mulberry32(42)
      ctx.lineWidth = 1
      // 每条边画1~2段电路走线
      for (let s = 0; s < 6; s++) {
        const [nx, ny] = sideNormal(s)
        const [ax,ay]=pts1[s],[bx,by]=pts1[(s+1)%6]
        const segs = 3
        for (let i = 0; i < segs; i++) {
          const t1 = (i + rng()*0.3 + 0.1)/segs, t2 = t1 + 0.12 + rng()*0.08
          if (t2 > 1) continue
          const startX=ax+(bx-ax)*t1, startY=ay+(by-ay)*t1
          const midX=ax+(bx-ax)*(t1+t2)/2, midY=ay+(by-ay)*(t1+t2)/2
          const endX=ax+(bx-ax)*t2, endY=ay+(by-ay)*t2
          const inset = gapW*(0.2+rng()*0.4)
          // L形走线
          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(startX + nx*inset, startY + ny*inset)
          ctx.lineTo(endX + nx*inset, endY + ny*inset)
          ctx.lineTo(endX, endY)
          ctx.stroke()
          // 焊点
          ;[[startX,startY],[endX,endY],[startX+nx*inset,startY+ny*inset],[endX+nx*inset,endY+ny*inset]].forEach(([px,py])=>{
            ctx.beginPath(); ctx.arc(px,py,1.8,0,Math.PI*2); ctx.fill()
          })
        }
      }
      break
    }

    case 'knurling': {
      // 滚花纹：交叉斜线菱形网格，工业防滑感
      ctx.lineWidth = 0.7
      const spacing = gapW * 0.4
      // 两组对角线（+45° 和 -45°）
      ;[1,-1].forEach(dir => {
        for (let s = 0; s < 6; s++) {
          const [ax,ay]=pts1[s],[bx,by]=pts1[(s+1)%6]
          const [nx,ny]=sideNormal(s)
          const edgeLen = Math.hypot(bx-ax, by-ay)
          const steps = Math.ceil(edgeLen / spacing)
          for (let i = 0; i < steps; i++) {
            const t = i/steps
            const ex=ax+(bx-ax)*t, ey=ay+(by-ay)*t
            // 沿边方向的切线
            const tx2=(bx-ax)/edgeLen, ty2=(by-ay)/edgeLen
            ctx.beginPath()
            ctx.moveTo(ex + (nx-tx2*dir)*0.5, ey + (ny-ty2*dir)*0.5)
            ctx.lineTo(ex + (nx+tx2*dir)*gapW + (tx2*dir)*spacing*0.5, ey + (ny+ty2*dir)*gapW + (ty2*dir)*spacing*0.5)
            ctx.stroke()
          }
        }
      })
      break
    }

    case 'dashed': {
      // 断点虚线纹：雷达扫描/UI加载圈感
      // 外边：长短交替虚线
      const pts_inner = hexPoints(cx, cy, R2.rx*1.02, R2.ry*1.02, rot)
      const pts_outer = hexPoints(cx, cy, R1.rx*0.98, R1.ry*0.98, rot)
      ;[[pts_outer, 1.5],[pts_inner, 0.8]].forEach(([pts, lw]) => {
        ctx.lineWidth = lw
        ctx.beginPath()
        let totalLen = 0
        const path = []
        for (let s = 0; s < 6; s++) {
          const [ax,ay]=pts[s],[bx,by]=pts[(s+1)%6]
          path.push({ax,ay,bx,by,len:Math.hypot(bx-ax,by-ay)})
          totalLen += Math.hypot(bx-ax,by-ay)
        }
        // 画虚线：长段(12px)-空(4px)-短段(4px)-空(4px)
        let drawn = 0
        const dashes = [12,4,4,4]
        let dashIdx = 0, dashRem = dashes[0], drawing = true
        path.forEach(({ax,ay,bx,by,len}) => {
          let seg = 0
          while (seg < len) {
            const step = Math.min(dashRem, len - seg)
            const t1 = seg/len, t2 = (seg+step)/len
            const x1=ax+(bx-ax)*t1, y1=ay+(by-ay)*t1
            const x2=ax+(bx-ax)*t2, y2=ay+(by-ay)*t2
            if (drawing) { ctx.moveTo(x1,y1); ctx.lineTo(x2,y2) }
            seg += step; dashRem -= step
            if (dashRem <= 0) { dashIdx=(dashIdx+1)%dashes.length; dashRem=dashes[dashIdx]; drawing=!drawing }
          }
        })
        ctx.stroke()
      })
      // 中线点阵
      ctx.globalAlpha = opacity * 0.6
      samplePerimeter({rx:midRx,ry:midRy}, 72).filter((_,i)=>i%3===0).forEach(({x,y})=>{
        ctx.beginPath(); ctx.arc(x,y,1.2,0,Math.PI*2); ctx.fill()
      })
      break
    }

    case 'greek_key': {
      // 希腊回纹：沿gap绘制方格折叠纹
      ctx.lineWidth = 1
      const step = gapW * 0.55
      for (let s = 0; s < 6; s++) {
        const [ax,ay]=pts2[s],[bx,by]=pts2[(s+1)%6]
        const [nx,ny]=sideNormal(s)
        const edgeLen=Math.hypot(bx-ax,by-ay)
        const tx=(bx-ax)/edgeLen, ty=(by-ay)/edgeLen
        const units=Math.floor(edgeLen/(step*2))
        for(let u=0;u<units;u++){
          const base=((u+0.5)*2*step)/edgeLen
          const ox=ax+tx*base*edgeLen, oy=ay+ty*base*edgeLen
          // 回字形：外→内→沿→内→外
          ctx.beginPath()
          ctx.moveTo(ox,oy)
          ctx.lineTo(ox+nx*step, oy+ny*step)
          ctx.lineTo(ox+nx*step+tx*step, oy+ny*step+ty*step)
          ctx.lineTo(ox+nx*step*0.5+tx*step, oy+ny*step*0.5+ty*step)
          ctx.lineTo(ox+nx*step*0.5+tx*step*1.5, oy+ny*step*0.5+ty*step*1.5)
          ctx.lineTo(ox+nx*step*0+tx*step*1.5, oy+ny*step*0+ty*step*1.5)
          ctx.stroke()
        }
      }
      break
    }

    case 'rivets': {
      // 钉头纹：等距铆钉圆点，蒸汽朋克感
      const rivetR = gapW * 0.28
      const rivetSpacing = gapW * 2.2
      samplePerimeter({rx:midRx,ry:midRy}, Math.round(
        hexPoints(cx,cy,midRx,midRy,rot).reduce((acc,p,i,arr)=>acc+Math.hypot((arr[(i+1)%6][0]-p[0]),(arr[(i+1)%6][1]-p[1])),0)/rivetSpacing
      )).forEach(({x,y})=>{
        // 铆钉本体（圆圈+中心亮点）
        ctx.beginPath(); ctx.arc(x,y,rivetR,0,Math.PI*2)
        ctx.lineWidth=1.2; ctx.stroke()
        ctx.beginPath(); ctx.arc(x,y,rivetR*0.4,0,Math.PI*2); ctx.fill()
      })
      break
    }

    case 'rope': {
      // 绳纹：双股螺旋交织，沿中线绕行
      ctx.lineWidth = gapW * 0.18
      ctx.lineCap = 'round'
      const samples = samplePerimeter({rx:midRx,ry:midRy}, 240)
      ;[0, Math.PI].forEach(phase => {
        ctx.beginPath()
        samples.forEach(({x,y,side,t},i)=>{
          const [nx,ny]=sideNormal(side)
          const wave=Math.sin(i/240*Math.PI*24+phase)*gapW*0.22
          const px=x+nx*wave, py=y+ny*wave
          i===0?ctx.moveTo(px,py):ctx.lineTo(px,py)
        })
        ctx.globalAlpha = opacity * 0.6; ctx.stroke()
      })
      break
    }

    case 'scrollwork': {
      // 巴洛克卷草纹：S形涡卷，优雅古典
      ctx.lineWidth = 0.9; ctx.lineCap = 'round'
      for (let s = 0; s < 6; s++) {
        const [ax,ay]=ptsMid[s],[bx,by]=ptsMid[(s+1)%6]
        const [nx,ny]=sideNormal(s)
        const edgeLen=Math.hypot(bx-ax,by-ay)
        const tx=(bx-ax)/edgeLen, ty=(by-ay)/edgeLen
        const scrolls=Math.floor(edgeLen/(gapW*2.5))
        for(let u=0;u<scrolls;u++){
          const t=(u+0.5)/scrolls
          const ox=ax+tx*t*edgeLen, oy=ay+ty*t*edgeLen
          const r=gapW*0.3
          // S形卷草（两个相对方向的半圆）
          ;[-1,1].forEach((dir,i)=>{
            ctx.beginPath()
            ctx.arc(
              ox+(nx*dir+tx*(i?0.5:-0.5))*r,
              oy+(ny*dir+ty*(i?0.5:-0.5))*r,
              r, dir>0?Math.PI:0, dir>0?0:Math.PI, dir<0
            )
            ctx.stroke()
          })
          // 叶片小三角
          ctx.beginPath()
          ctx.moveTo(ox,oy)
          ctx.lineTo(ox+nx*r*.6+tx*r*.3, oy+ny*r*.6+ty*r*.3)
          ctx.lineTo(ox-tx*r*.3, oy-ty*r*.3)
          ctx.closePath(); ctx.globalAlpha=opacity*0.4; ctx.fill()
          ctx.globalAlpha=opacity
        }
      }
      break
    }
    case 'wave': {
      // 水波纹：沿gap绘制正弦水波，宁静流动感
      ctx.lineWidth = 0.9; ctx.lineCap = 'round'
      const waveRows = 4  // gap内波浪行数
      for (let row = 0; row < waveRows; row++) {
        const rowT = (row + 0.5) / waveRows  // 0~1 在gap内的位置
        for (let s = 0; s < 6; s++) {
          const [ax,ay] = pts2[s], [bx,by] = pts2[(s+1)%6]
          const [nx,ny] = sideNormal(s)
          const offset = gapW * rowT
          const edgeLen = Math.hypot(bx-ax, by-ay)
          const tx = (bx-ax)/edgeLen, ty = (by-ay)/edgeLen
          // 波浪振幅随行数变化
          const amp = gapW * 0.12 * (1 - Math.abs(rowT - 0.5) * 1.5)
          const freq = 6 + row  // 频率略有差异
          ctx.beginPath()
          const steps = Math.ceil(edgeLen / 3)
          for (let i = 0; i <= steps; i++) {
            const t = i / steps
            const ex = ax + tx*t*edgeLen + nx*offset
            const ey = ay + ty*t*edgeLen + ny*offset
            const wave = Math.sin(t * Math.PI * freq) * amp
            const px = ex + nx*wave, py = ey + ny*wave
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.globalAlpha = opacity * (0.4 + row * 0.15)
          ctx.stroke()
        }
      }
      break
    }
  }
}

const BadgeCanvas = forwardRef(function BadgeCanvas({ config, layers, selectedId, onLayerChange }, ref) {
  const canvasRef = useRef(null)
  const hexW = config.hexW ?? 1228
  const hexH = config.hexH ?? 1417
  const { rx: baseRx, ry: baseRy } = getRxRy(hexW, hexH)
  const CW = Math.round(hexW + PADDING * 2)
  const CH = Math.round(hexH + PADDING * 2)
  const cx = CW / 2, cy = CH / 2
  const hexRot = -Math.PI / 6

  const previewMax = 460
  const previewScale = Math.min(previewMax/CW, previewMax/CH)

  const drag = useRef(null)

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      const canvas = canvasRef.current
      if (!canvas) return null
      // 临时重绘，不显示控制框
      drawForExport()
      const dataUrl = canvas.toDataURL('image/png')
      // 恢复正常显示
      draw()
      return dataUrl
    }
  }))

  const drawForExport = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CW; canvas.height = CH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0,0,CW,CH)
    const outerW=safeR(config.outerBorderWidth??30),gapW=safeR(config.gapWidth??24),innerW=safeR(config.innerBorderWidth??12),innerLineW=Math.max(0,config.innerLineWidth??3)
    const R0={rx:baseRx,ry:baseRy},R1={rx:safeR(R0.rx-outerW),ry:safeR(R0.ry-outerW)},R2={rx:safeR(R1.rx-gapW),ry:safeR(R1.ry-gapW)},R3={rx:safeR(R2.rx-innerW),ry:safeR(R2.ry-innerW)},R4={rx:safeR(R3.rx-innerLineW*2),ry:safeR(R3.ry-innerLineW*2)}
    const sorted=[...(layers||[])].sort((a,b)=>a.zIndex-b.zIndex)
    // 按zIndex统一渲染（背景/装饰/人物/文字混合，边框固定盖在上方）
    for(const l of sorted){
      if(!l.visible) continue
      if(l.type==='background'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot));ctx.clip()
        drawBg(ctx,cx,cy,CW,CH,R3,hexRot,l);ctx.restore()
      }
      if(l.type==='decoration'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot));ctx.clip()
        drawShape(ctx,l,false,cx,cy);ctx.restore()
      }
      if(l.type==='character'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot));ctx.clip()
        drawCharacter(ctx,cx,cy,R3,l);ctx.restore()
      }
      if(l.type==='text'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot));ctx.clip()
        drawTextLayer(ctx,l);ctx.restore()
      }
    }
    // 边框
    drawRing(ctx,cx,cy,R0.rx,R0.ry,R1.rx,R1.ry,hexRot,config.outerBorderColor??'#1a1628')
    drawRing(ctx,cx,cy,R1.rx,R1.ry,R2.rx,R2.ry,hexRot,config.gapColor??'#e8e0d0')
    if(config.borderPattern && config.borderPattern!=='none'){
      const patC=document.createElement('canvas');patC.width=CW;patC.height=CH
      const patX=patC.getContext('2d')
      drawBorderPattern(patX,cx,cy,R1,R2,hexRot,config)
      patX.globalCompositeOperation='destination-in'
      patX.beginPath()
      hexPoints(cx,cy,R1.rx,R1.ry,hexRot).forEach(([x,y],i)=>i===0?patX.moveTo(x,y):patX.lineTo(x,y));patX.closePath()
      hexPoints(cx,cy,R2.rx,R2.ry,hexRot).slice().reverse().forEach(([x,y],i)=>i===0?patX.moveTo(x,y):patX.lineTo(x,y));patX.closePath()
      patX.fillStyle='rgba(0,0,0,1)';patX.fill('evenodd')
      ctx.drawImage(patC,0,0)
    }
    ctx.save();ctx.beginPath()
    hexPoints(cx,cy,R2.rx,R2.ry,hexRot).forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));ctx.closePath()
    hexPoints(cx,cy,R3.rx,R3.ry,hexRot).slice().reverse().forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y));ctx.closePath()
    const ic1=config.innerBorderColor1??'#f5e090',ic2=config.innerBorderColor2??'#9a7235'
    if(config.innerBorderSolid){ctx.fillStyle=ic1}else{const g=ctx.createLinearGradient(cx-R2.rx,cy-R2.ry,cx+R2.rx,cy+R2.ry);g.addColorStop(0,ic1);g.addColorStop(.4,ic2);g.addColorStop(1,ic1);ctx.fillStyle=g}
    ctx.fill('evenodd');ctx.restore()
    if(innerLineW>0&&R4.rx>4){ctx.save();tracePath(ctx,hexPoints(cx,cy,R4.rx,R4.ry,hexRot));ctx.strokeStyle=config.innerLineColor??'rgba(200,169,110,0.5)';ctx.lineWidth=innerLineW;ctx.stroke();ctx.restore()}
  }, [config, layers, CW, CH, cx, cy, baseRx, baseRy])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CW; canvas.height = CH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0,0,CW,CH)

    const outerW=safeR(config.outerBorderWidth??30)
    const gapW=safeR(config.gapWidth??24)
    const innerW=safeR(config.innerBorderWidth??12)
    const innerLineW=Math.max(0,config.innerLineWidth??3)

    const R0={rx:baseRx,ry:baseRy}
    const R1={rx:safeR(R0.rx-outerW),ry:safeR(R0.ry-outerW)}
    const R2={rx:safeR(R1.rx-gapW),ry:safeR(R1.ry-gapW)}
    const R3={rx:safeR(R2.rx-innerW),ry:safeR(R2.ry-innerW)}
    const R4={rx:safeR(R3.rx-innerLineW*2),ry:safeR(R3.ry-innerLineW*2)}

    const sorted=[...(layers||[])].sort((a,b)=>a.zIndex-b.zIndex)

    // 按zIndex统一渲染（背景/装饰/人物/文字混合，边框固定盖在上方）
    for(const l of sorted){
      if(!l.visible) continue
      if(l.type==='background'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot));ctx.clip()
        drawBg(ctx,cx,cy,CW,CH,R3,hexRot,l);ctx.restore()
      }
      if(l.type==='decoration'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R3.rx,R3.ry,hexRot));ctx.clip()
        drawShape(ctx,l,false,cx,cy);ctx.restore()
      }
      if(l.type==='character'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot));ctx.clip()
        drawCharacter(ctx,cx,cy,R3,l);ctx.restore()
      }
      if(l.type==='text'){
        ctx.save();tracePath(ctx,hexPoints(cx,cy,R0.rx,R0.ry,hexRot));ctx.clip()
        drawTextLayer(ctx,l);ctx.restore()
      }
    }
    // 选中框（始终在所有内容+边框之上）
    const selLayer=sorted.find(l=>l.id===selectedId&&l.type==='text')
    if(selLayer) drawSelectionBox(ctx,selLayer)
    // 装饰选中框
    const selDecor=sorted.find(l=>l.id===selectedId&&l.type==='decoration')
    if(selDecor) drawShape(ctx,selDecor,true,cx,cy)
    // 边框（固定盖在内容上方）
    drawRing(ctx,cx,cy,R0.rx,R0.ry,R1.rx,R1.ry,hexRot,config.outerBorderColor??'#1a1628')
    drawRing(ctx,cx,cy,R1.rx,R1.ry,R2.rx,R2.ry,hexRot,config.gapColor??'#e8e0d0')
    if(config.borderPattern&&config.borderPattern!=='none'){
      // offscreen canvas 绘制纹路，再用 destination-in 裁剪到gap区域
      const patC=document.createElement('canvas');patC.width=CW;patC.height=CH
      const patX=patC.getContext('2d')
      drawBorderPattern(patX,cx,cy,R1,R2,hexRot,config)
      patX.globalCompositeOperation='destination-in'
      patX.beginPath()
      hexPoints(cx,cy,R1.rx,R1.ry,hexRot).forEach(([x,y],i)=>i===0?patX.moveTo(x,y):patX.lineTo(x,y));patX.closePath()
      hexPoints(cx,cy,R2.rx,R2.ry,hexRot).slice().reverse().forEach(([x,y],i)=>i===0?patX.moveTo(x,y):patX.lineTo(x,y));patX.closePath()
      patX.fillStyle='rgba(0,0,0,1)';patX.fill('evenodd')
      ctx.drawImage(patC,0,0)
    }
    ctx.save(); ctx.beginPath()
    hexPoints(cx,cy,R2.rx,R2.ry,hexRot).forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
    hexPoints(cx,cy,R3.rx,R3.ry,hexRot).slice().reverse().forEach(([x,y],i)=>i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)); ctx.closePath()
    const ic1=config.innerBorderColor1??'#f5e090',ic2=config.innerBorderColor2??'#9a7235'
    if(config.innerBorderSolid){ctx.fillStyle=ic1}else{
      const g=ctx.createLinearGradient(cx-R2.rx,cy-R2.ry,cx+R2.rx,cy+R2.ry)
      g.addColorStop(0,ic1);g.addColorStop(.4,ic2);g.addColorStop(1,ic1);ctx.fillStyle=g
    }
    ctx.fill('evenodd'); ctx.restore()
    if(innerLineW>0&&R4.rx>4){
      ctx.save();tracePath(ctx,hexPoints(cx,cy,R4.rx,R4.ry,hexRot))
      ctx.strokeStyle=config.innerLineColor??'rgba(200,169,110,0.5)';ctx.lineWidth=innerLineW;ctx.stroke();ctx.restore()
    }

  }, [config, layers, selectedId, CW, CH, cx, cy, baseRx, baseRy])

  // ─── 背景 ───
  function drawBg(ctx,cx,cy,cw,ch,R,rot,layer){
    ctx.save();ctx.globalAlpha=layer.opacity??1
    const c1=layer.color1??'#1a1a2e',c2=layer.color2??'#0a0818',c3=layer.color3??null
    const angle=((layer.gradientAngle??135)*Math.PI)/180
    const rx=safeR(R.rx),ry=safeR(R.ry)
    const fill=(s)=>{ctx.fillStyle=s;ctx.fillRect(0,0,cw,ch)}
    switch(layer.bgType??'solid'){
      case 'solid':fill(c1);break
      case 'linear':case 'linear_diagonal':case 'linear_h':case 'linear_v':{
        const a=layer.bgType==='linear_h'?0:layer.bgType==='linear_v'?Math.PI/2:angle
        const g=ctx.createLinearGradient(cx-Math.cos(a)*rx,cy-Math.sin(a)*ry,cx+Math.cos(a)*rx,cy+Math.sin(a)*ry)
        c3?(g.addColorStop(0,c1),g.addColorStop(.5,c3),g.addColorStop(1,c2)):(g.addColorStop(0,c1),g.addColorStop(1,c2));fill(g);break}
      case 'linear_hard':{const sp=layer.hardSplit??0.5;const g=ctx.createLinearGradient(cx,cy-ry,cx,cy+ry);g.addColorStop(0,c1);g.addColorStop(Math.max(0,sp-.001),c1);g.addColorStop(Math.min(1,sp),c2);g.addColorStop(1,c2);fill(g);break}
      case 'radial':{const g=ctx.createRadialGradient(cx,cy,0,cx,cy,safeR(Math.max(rx,ry)));g.addColorStop(0,c1);g.addColorStop(1,c2);fill(g);break}
      case 'radial_offcenter':{const ox=(layer.radialOX??0)*rx/100,oy=(layer.radialOY??-40)*ry/100;const g=ctx.createRadialGradient(cx+ox,cy+oy,0,cx,cy,safeR(Math.max(rx,ry)*1.2));g.addColorStop(0,c1);g.addColorStop(1,c2);fill(g);break}
      case 'radial_hex':fill(c2);for(let i=12;i>=0;i--){const t=i/12;tracePath(ctx,hexPoints(cx,cy,rx*t,ry*t,rot));ctx.fillStyle=blendHex(c1,c2,1-t);ctx.fill()};break
      case 'conical':for(let i=0;i<360;i++){ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,Math.max(rx,ry)*1.5,Math.PI*2*i/360,Math.PI*2*(i+1)/360);ctx.closePath();ctx.fillStyle=blendHex(c1,c2,i/360);ctx.fill()};break
      case 'pattern_hex':{fill(c1);const hs=layer.patternSize??20;ctx.strokeStyle=c2;ctx.lineWidth=1.5;for(let row=-2;row<ch/hs+2;row++){for(let col=-2;col<cw/(hs*1.732)+2;col++){const hx=col*hs*1.732+(row%2)*hs*.866,hy=row*hs*1.5;ctx.beginPath();for(let k=0;k<6;k++){const ka=(Math.PI/3)*k-Math.PI/6;k===0?ctx.moveTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka)):ctx.lineTo(hx+hs*Math.cos(ka),hy+hs*Math.sin(ka))}ctx.closePath();ctx.stroke()}};break}
      case 'pattern_stripe':{fill(c1);const sz=layer.patternSize??20;ctx.fillStyle=c2;for(let x=-ch;x<cw+ch;x+=sz*2){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+sz,0);ctx.lineTo(x+sz-ch,ch);ctx.lineTo(x-ch,ch);ctx.closePath();ctx.fill()};break}
      case 'stars':{fill(c1);const rng=mulberry32(42);for(let i=0;i<140;i++){ctx.beginPath();ctx.arc(rng()*cw,rng()*ch,rng()*1.8+.4,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${(rng()*.5+.4).toFixed(2)})`;ctx.fill()};break}

      case 'cyberpunk':{
        // 赛博朋克霓虹：深色底+霓虹扫光+网格线
        fill(c1||'#050510')
        // 网格
        ctx.strokeStyle='rgba(0,255,200,0.08)'; ctx.lineWidth=1
        const gs=30
        for(let x=0;x<cw;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,ch);ctx.stroke()}
        for(let y=0;y<ch;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cw,y);ctx.stroke()}
        // 霓虹光带
        const nc1=c2||'#ff00aa', nc2=c1||'#00ffcc'
        const ng1=ctx.createLinearGradient(0,cy,cw,cy)
        ng1.addColorStop(0,'rgba(0,0,0,0)')
        ng1.addColorStop(0.3,hexToRgba(nc1,0.18))
        ng1.addColorStop(0.5,hexToRgba(nc2,0.28))
        ng1.addColorStop(0.7,hexToRgba(nc1,0.18))
        ng1.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=ng1; ctx.fillRect(0,0,cw,ch)
        // 顶部/底部扫光
        const ng2=ctx.createLinearGradient(cx,0,cx,ch)
        ng2.addColorStop(0,hexToRgba(nc2,0.15))
        ng2.addColorStop(0.4,'rgba(0,0,0,0)')
        ng2.addColorStop(0.6,'rgba(0,0,0,0)')
        ng2.addColorStop(1,hexToRgba(nc1,0.15))
        ctx.fillStyle=ng2; ctx.fillRect(0,0,cw,ch)
        // 中心光点
        const cg=ctx.createRadialGradient(cx,cy,0,cx,cy,safeR(Math.max(rx,ry)*.5))
        cg.addColorStop(0,hexToRgba(nc2,0.12)); cg.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=cg; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'fog':{
        // 云雾：用正弦波叠加模拟体积云
        fill(c1||'#1a2035')
        const fogColor=c2||'#99aace'
        // 横向云带（用正弦波生成有机云形）
        for(let band=0;band<8;band++){
          const seed=band*137.508
          const baseY=ch*(band/8)+(Math.sin(seed)*ch*.1)
          const bandH=ch*(0.18+Math.sin(seed*1.3)*.08)
          for(let x=0;x<=cw;x+=3){
            const wave1=Math.sin(x/cw*Math.PI*3+seed)*bandH*.35
            const wave2=Math.sin(x/cw*Math.PI*5.3+seed*1.7)*bandH*.2
            const wave3=Math.sin(x/cw*Math.PI*8.1+seed*2.3)*bandH*.1
            const top=baseY+wave1+wave2+wave3
            const bot=top+bandH+Math.sin(x/cw*Math.PI*4+seed*1.1)*bandH*.3
            const alpha=(0.06+Math.abs(Math.sin(seed+x/cw*2))*.08)
            const cg=ctx.createLinearGradient(x,top,x,bot)
            cg.addColorStop(0,`rgba(0,0,0,0)`)
            cg.addColorStop(0.3,hexToRgba(fogColor,alpha))
            cg.addColorStop(0.7,hexToRgba(fogColor,alpha*.6))
            cg.addColorStop(1,`rgba(0,0,0,0)`)
            ctx.fillStyle=cg; ctx.fillRect(x,top,3,bot-top+1)
          }
        }
        // 深景薄雾（全局）
        const mist=ctx.createLinearGradient(0,0,0,ch)
        mist.addColorStop(0,hexToRgba(fogColor,0.08))
        mist.addColorStop(0.5,hexToRgba(fogColor,0.04))
        mist.addColorStop(1,hexToRgba(fogColor,0.1))
        ctx.fillStyle=mist; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'marble':{
        // 大理石：斜向流动脉络+宽幅色带，明显区别于其他石纹
        fill(c1||'#f0ece4')
        const [r1m,g1m,b1m]=hexToRgb(c1||'#f0ece4')
        const [r2m,g2m,b2m]=hexToRgb(c2||'#5a5048')
        // 主体：大幅斜向脉络（45°方向，明显扭曲）
        const veins=12
        for(let i=0;i<veins;i++){
          const t=i/veins
          const baseX=cw*t*1.5-cw*.25
          ctx.beginPath()
          ctx.moveTo(baseX, 0)
          for(let y=0;y<=ch;y+=3){
            const x=baseX
              +Math.sin(y/ch*Math.PI*4+t*6)*cw*.12
              +Math.sin(y/ch*Math.PI*9+t*11)*cw*.04
              +Math.sin(y/ch*Math.PI*2+t*3)*cw*.08
            ctx.lineTo(x,y)
          }
          const thickness=Math.abs(Math.sin(t*7))*8+1
          const alpha=Math.abs(Math.sin(t*5+1))*0.35+0.08
          ctx.strokeStyle=hexToRgba(c2||'#5a5048',alpha)
          ctx.lineWidth=thickness; ctx.stroke()
        }
        // 细脉（在粗脉之间加密）
        for(let i=0;i<30;i++){
          const t=i/30
          const baseX=cw*t*1.4-cw*.2+Math.sin(i*2.3)*cw*.05
          ctx.beginPath(); ctx.moveTo(baseX,0)
          for(let y=0;y<=ch;y+=5){
            const x=baseX+Math.sin(y/ch*Math.PI*7+t*9)*cw*.06
            ctx.lineTo(x,y)
          }
          ctx.strokeStyle=hexToRgba(c2||'#5a5048',0.06)
          ctx.lineWidth=0.5; ctx.stroke()
        }
        // 底色光泽
        const mgl=ctx.createLinearGradient(0,0,cw,ch)
        mgl.addColorStop(0,'rgba(255,255,255,0.15)')
        mgl.addColorStop(0.5,'rgba(255,255,255,0.05)')
        mgl.addColorStop(1,'rgba(0,0,0,0.08)')
        ctx.fillStyle=mgl; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'granite':{
        // 花岗岩：三种矿物颗粒混合，颗粒感强烈，无明显方向性
        fill(c1||'#9a9490')
        const rng3=mulberry32(123)
        // 三类矿物颗粒（长石/石英/云母）
        const minerals=[
          {color:c2||'#2a2825', minR:1, maxR:5, density:0.4},  // 深色矿物
          {color:'#ffffff',     minR:0.5, maxR:3, density:0.25}, // 石英白
          {color:'#d4c8b0',     minR:1, maxR:4, density:0.35},  // 长石米
        ]
        minerals.forEach(({color,minR,maxR,density})=>{
          const count=Math.round(cw*ch*density/120)
          for(let i=0;i<count;i++){
            const sx=rng3()*cw, sy=rng3()*ch
            const sr=rng3()*(maxR-minR)+minR
            const angle=rng3()*Math.PI
            // 椭圆颗粒（模拟矿物晶体形状）
            ctx.save(); ctx.translate(sx,sy); ctx.rotate(angle)
            ctx.beginPath(); ctx.ellipse(0,0,sr,sr*(0.4+rng3()*.4),0,0,Math.PI*2)
            ctx.fillStyle=hexToRgba(color,rng3()*.6+.35); ctx.fill()
            ctx.restore()
          }
        })
        // 整体轻微暗角
        const gv=ctx.createRadialGradient(cx,cy,Math.min(rx,ry)*.3,cx,cy,safeR(Math.max(rx,ry)*1.1))
        gv.addColorStop(0,'rgba(255,255,255,0.05)'); gv.addColorStop(1,'rgba(0,0,0,0.12)')
        ctx.fillStyle=gv; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'jade':{
        // 玉石：大色块云状过渡+透明内光，强调温润质感
        fill(c1||'#2d6e4e')
        const [r1j,g1j,b1j]=hexToRgb(c1||'#2d6e4e')
        const [r2j,g2j,b2j]=hexToRgb(c2||'#8dd4b0')
        // 大范围色块云（模拟玉石内部颜色渗透）
        const jcloud=[
          [cx*.6,cy*.7,rx*.7],[cx*1.3,cy*.5,rx*.5],
          [cx*.8,cy*1.3,rx*.6],[cx*1.2,cy*1.2,rx*.55],
          [cx,cy,rx*.4],
        ]
        jcloud.forEach(([jx,jy,jr],i)=>{
          const jg2=ctx.createRadialGradient(jx,jy,0,jx,jy,safeR(jr))
          const t=i/jcloud.length
          const rj=Math.round(r1j+(r2j-r1j)*t), gj=Math.round(g1j+(g2j-g1j)*t), bj=Math.round(b1j+(b2j-b1j)*t)
          jg2.addColorStop(0,`rgba(${rj},${gj},${bj},0.6)`)
          jg2.addColorStop(0.5,`rgba(${rj},${gj},${bj},0.2)`)
          jg2.addColorStop(1,'rgba(0,0,0,0)')
          ctx.fillStyle=jg2; ctx.fillRect(0,0,cw,ch)
        })
        // 少量细脉（区别于大理石的稀疏感）
        for(let i=0;i<8;i++){
          const t=i/8, py=ch*t
          ctx.beginPath(); ctx.moveTo(0,py)
          for(let x=0;x<=cw;x+=8){
            ctx.lineTo(x, py+Math.sin(x/cw*Math.PI*3+t*5)*ch*.03+Math.sin(x/cw*Math.PI*7+t*9)*ch*.015)
          }
          ctx.strokeStyle=hexToRgba(c2||'#8dd4b0',0.25)
          ctx.lineWidth=Math.abs(Math.sin(t*4))*3+0.5; ctx.stroke()
        }
        // 玉石光泽（强偏光高亮）
        const jhl=ctx.createRadialGradient(cx*.5,cy*.4,0,cx*.5,cy*.4,safeR(Math.min(rx,ry)*.7))
        jhl.addColorStop(0,'rgba(255,255,255,0.3)'); jhl.addColorStop(0.4,'rgba(255,255,255,0.06)'); jhl.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=jhl; ctx.fillRect(0,0,cw,ch)
        break
      }
      case 'sandstone':{
        // 砂岩：峡谷截面感，厚实色带+粗犷裂缝+砂粒噪点
        fill(c1||'#c8a060')
        const [r1s,g1s,b1s]=hexToRgb(c1||'#c8a060')
        const [r2s,g2s,b2s]=hexToRgb(c2||'#7a4820')
        // 粗分层（5~8个明显色带，比大理石宽得多）
        const bigLayers=7
        for(let i=0;i<bigLayers;i++){
          const t=i/bigLayers
          const y=t*ch
          const lh=ch/bigLayers*(0.7+Math.abs(Math.sin(i*1.9))*.6)
          const mix=Math.min(1,Math.max(0,t+Math.sin(i*2.1)*.2))
          const rr=Math.round(r1s+(r2s-r1s)*mix)
          const gr=Math.round(g1s+(g2s-g1s)*mix)
          const br=Math.round(b1s+(b2s-b1s)*mix)
          ctx.fillStyle=`rgb(${rr},${gr},${br})`
          // 层边缘用波形（地质层不是直线）
          ctx.beginPath()
          const pts=[]
          for(let x=0;x<=cw;x+=6){pts.push([x,y+Math.sin(x/cw*Math.PI*3+i*1.3)*8+Math.sin(x/cw*Math.PI*7+i)*3])}
          pts.forEach(([x,py],idx)=>idx===0?ctx.moveTo(x,py):ctx.lineTo(x,py))
          ctx.lineTo(cw,y+lh); ctx.lineTo(0,y+lh); ctx.closePath(); ctx.fill()
          // 明显层间裂缝（比原版更粗）
          ctx.beginPath()
          pts.forEach(([x,py],idx)=>idx===0?ctx.moveTo(x,py):ctx.lineTo(x,py))
          ctx.strokeStyle=hexToRgba(c2||'#7a4820',0.5); ctx.lineWidth=1.5; ctx.stroke()
        }
        // 砂粒噪点（纯粹随机小点，区别于花岗岩的矿物椭圆）
        const rng_s=mulberry32(55)
        for(let i=0;i<cw*ch/40;i++){
          const sx=rng_s()*cw, sy=rng_s()*ch
          ctx.fillStyle=`rgba(${Math.round(rng_s()*60+160)},${Math.round(rng_s()*40+100)},${Math.round(rng_s()*30+50)},${(rng_s()*.3+.05).toFixed(2)})`
          ctx.fillRect(sx,sy,1,1)
        }
        break
      }
      case 'obsidian':{
        // 黑曜石：贝壳状断口（同心弧形纹）+强镜面反光，无方向性脉络
        fill(c1||'#080608')
        // 贝壳状断口：以断裂点为圆心的弧形纹（obsidian特有）
        const fracturePts=[[cx*.7,cy*.6],[cx*1.2,cy*1.3],[cx*.5,cy*1.1]]
        fracturePts.forEach(([fx,fy])=>{
          for(let r=10;r<Math.max(rx,ry)*1.4;r+=Math.max(rx,ry)*0.06+r*0.04){
            ctx.beginPath(); ctx.arc(fx,fy,r,0,Math.PI*2)
            ctx.strokeStyle=hexToRgba(c2||'#4030a0',Math.max(0.01,0.12-r/Math.max(rx,ry)*0.1))
            ctx.lineWidth=0.8; ctx.stroke()
          }
        })
        // 强镜面：大面积高光（黑曜石最显著特征）
        const oReflect=ctx.createLinearGradient(0,0,cw*.6,ch*.5)
        oReflect.addColorStop(0,'rgba(255,255,255,0.18)')
        oReflect.addColorStop(0.2,'rgba(255,255,255,0.06)')
        oReflect.addColorStop(0.4,'rgba(255,255,255,0)')
        ctx.fillStyle=oReflect; ctx.fillRect(0,0,cw,ch)
        // 紫色/蓝色内部光（天然黑曜石的彩虹晕）
        const oIris=ctx.createRadialGradient(cx*.6,cy*.5,0,cx*.6,cy*.5,safeR(Math.max(rx,ry)*.7))
        oIris.addColorStop(0,hexToRgba(c2||'#4030a0',0.2))
        oIris.addColorStop(0.5,hexToRgba(c2||'#4030a0',0.06))
        oIris.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=oIris; ctx.fillRect(0,0,cw,ch)
        // 锋利边缘高光点
        const oSpec=ctx.createRadialGradient(cx*.35,cy*.3,0,cx*.35,cy*.3,safeR(Math.min(rx,ry)*.2))
        oSpec.addColorStop(0,'rgba(255,255,255,0.35)'); oSpec.addColorStop(1,'rgba(0,0,0,0)')
        ctx.fillStyle=oSpec; ctx.fillRect(0,0,cw,ch)
        break
      }

      case 'image':{if(layer.image){const img=layer.image;const sc=Math.max(cw/img.naturalWidth,ch/img.naturalHeight);ctx.drawImage(img,(cw-img.naturalWidth*sc)/2,(ch-img.naturalHeight*sc)/2,img.naturalWidth*sc,img.naturalHeight*sc)};break}
    }
    ctx.restore()
  }

  // ─── 人物（含镀层效果）───
  function drawCharacter(ctx,cx,cy,R3,layer){
    if(!layer.image)return
    ctx.save();ctx.globalAlpha=layer.opacity??1
    const img=layer.image,scale=layer.scale??1
    const ox=(layer.offsetX??0)*2,oy=(layer.offsetY??0)*2
    const fitH=R3.ry*2*1.15*scale,fitW=(img.naturalWidth/img.naturalHeight)*fitH
    const dx=cx-fitW/2+ox, dy=cy-fitH/2+oy

    ctx.drawImage(img,dx,dy,fitW,fitH)

    // 镀层效果
    if(layer.plating){
      ctx.save()
      // clip到人物图片区域（矩形近似）
      ctx.globalAlpha=(layer.opacity??1)*0.55
      ctx.globalCompositeOperation='source-atop'

      const platingColors={
        gold:    ['#ffe066','#c8860a','#ffe8a0','#b06000'],
        aurora:  ['#cc88ff','#4422cc','#88ffee','#aa44ff'],
        silver:  ['#ffffff','#8888aa','#ddddee','#6666aa'],
        crimson: ['#ff4422','#880000','#ffaa88','#cc2200'],
        void:    ['#9933ff','#330066','#cc66ff','#220044'],
      }
      const cols=platingColors[layer.platingType??'gold']

      // 拉丝纹理
      const stripeCount=Math.ceil(fitH/8)
      for(let i=0;i<stripeCount;i++){
        const t=i/stripeCount
        const sg=ctx.createLinearGradient(dx,dy+t*fitH,dx+fitW,dy+t*fitH)
        sg.addColorStop(0,cols[0]+'44')
        sg.addColorStop(0.3,cols[2]+'88')
        sg.addColorStop(0.7,cols[0]+'44')
        sg.addColorStop(1,cols[3]+'33')
        ctx.fillStyle=sg
        ctx.fillRect(dx,dy+t*fitH,fitW,fitH/stripeCount+1)
      }

      // 光泽扫光
      const sweepG=ctx.createLinearGradient(dx,dy,dx+fitW,dy+fitH)
      sweepG.addColorStop(0,'rgba(255,255,255,0)')
      sweepG.addColorStop(0.35,'rgba(255,255,255,0)')
      sweepG.addColorStop(0.45,cols[2]+'cc')
      sweepG.addColorStop(0.55,'rgba(255,255,255,0)')
      sweepG.addColorStop(1,'rgba(255,255,255,0)')
      ctx.fillStyle=sweepG
      ctx.fillRect(dx,dy,fitW,fitH)

      ctx.restore()

      // 边缘粒子
      ctx.save()
      ctx.globalAlpha=(layer.opacity??1)*0.7
      const rng=mulberry32(layer.id??42)
      for(let i=0;i<30;i++){
        const px=dx+rng()*fitW
        const py=dy+rng()*fitH
        const pr=rng()*3+1
        ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2)
        ctx.fillStyle=cols[Math.floor(rng()*cols.length)]+'cc'
        ctx.fill()
      }
      ctx.restore()
    }

    ctx.restore()
  }

  // ─── 文字（只画文字内容，不画选中框）───
  function drawTextLayer(ctx,layer){
    if(!layer.text)return
    const x=layer.textX??cx, y=layer.textY??cy
    const w=layer.textW??400
    const r=layer.textRot??0
    ctx.save(); ctx.translate(x,y); ctx.rotate(r); ctx.globalAlpha=layer.opacity??1
    const fs=(layer.fontSize??24)*2
    const fontName=layer.font??'Cinzel Decorative'
    const dubaiWeightMap={'Dubai Light':'300 ','Dubai':'400 ','Dubai Medium':'500 ','Dubai Bold':'700 '}
    const fontWeight=dubaiWeightMap[fontName]?dubaiWeightMap[fontName]:(layer.bold?'bold ':'')
    const fontFamily=dubaiWeightMap[fontName]?'"Dubai"':`"${fontName}"`
    ctx.font=`${fontWeight}${fs}px ${fontFamily},"MiSans","Noto Serif SC",serif`
    ctx.fillStyle=layer.color??'#e8c97a'; ctx.textAlign='center'; ctx.textBaseline='middle'
    const lines=(layer.text||'').split('\n'), lineH=fs*1.3
    lines.forEach((line,i)=>ctx.fillText(line,0,(i-(lines.length-1)/2)*lineH,w*.95))
    ctx.restore()
  }

  // ─── 选中控制框（始终画在所有内容最顶层）───
  function drawSelectionBox(ctx,layer){
    const x=layer.textX??cx, y=layer.textY??cy
    const w=layer.textW??400, h=layer.textH??100
    const r=layer.textRot??0
    ctx.save(); ctx.translate(x,y); ctx.rotate(r)
    ctx.strokeStyle='rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.setLineDash([6,4])
    ctx.strokeRect(-w/2,-h/2,w,h);ctx.setLineDash([])
    ctx.strokeStyle='rgba(100,180,255,0.6)';ctx.lineWidth=1.5
    ctx.beginPath();ctx.moveTo(0,-h/2);ctx.lineTo(0,-h/2-ROT_OFFSET);ctx.stroke()
    const dH=(lx,ly,isR)=>{ctx.beginPath();ctx.arc(lx,ly,HANDLE_R,0,Math.PI*2);ctx.fillStyle=isR?'#ffd700':'white';ctx.fill();ctx.strokeStyle=isR?'#c8a000':'rgba(100,180,255,0.9)';ctx.lineWidth=2;ctx.stroke()}
    ;[[-w/2,-h/2],[0,-h/2],[w/2,-h/2],[w/2,0],[w/2,h/2],[0,h/2],[-w/2,h/2],[-w/2,0]].forEach(([lx,ly])=>dH(lx,ly,false))
    dH(0,-h/2-ROT_OFFSET,true)
    ctx.restore()
  }

  // ─── 交互（文字+装饰共用） ───
  const getInteractiveLayers = useCallback(() => {
    return (layers||[]).filter(l=>l.visible&&(l.type==='text'||l.type==='decoration'))
  }, [layers])

  const handleMouseDown = useCallback((e) => {
    if(e.button!==0) return
    const canvas=canvasRef.current
    const pt=canvasPt(e,canvas)
    const selected=layers?.find(l=>l.id===selectedId&&(l.type==='text'||l.type==='decoration'))

    // 先检测选中图层的控制手柄
    if(selected){
      const xKey=selected.type==='decoration'?'shapeX':'textX'
      const yKey=selected.type==='decoration'?'shapeY':'textY'
      const defX=selected[xKey]??cx, defY=selected[yKey]??cy
      const{handles,rotHandle}=getHandles(selected,defX,defY)
      const hit=hitHandle(pt,handles,rotHandle)
      if(hit){
        drag.current={type:hit.type,idx:hit.idx,layerId:selected.id,layerType:selected.type,startPt:pt,startLayer:{...selected}}
        e.preventDefault();return
      }
      if(ptInBox(pt,selected,defX,defY)){
        drag.current={type:'move',layerId:selected.id,layerType:selected.type,startPt:pt,startLayer:{...selected}}
        e.preventDefault();return
      }
    }

    // 点击其他可交互图层
    const interactive=getInteractiveLayers()
    for(let i=interactive.length-1;i>=0;i--){
      const l=interactive[i]
      const defX=(l.type==='decoration'?l.shapeX:l.textX)??cx
      const defY=(l.type==='decoration'?l.shapeY:l.textY)??cy
      if(ptInBox(pt,l,defX,defY)){
        onLayerChange&&onLayerChange('select',l.id)
        drag.current={type:'move',layerId:l.id,layerType:l.type,startPt:pt,startLayer:{...l}}
        e.preventDefault();return
      }
    }
  },[layers,selectedId,cx,cy,getInteractiveLayers,onLayerChange])

  const handleMouseMove = useCallback((e)=>{
    if(!drag.current)return
    const canvas=canvasRef.current
    const pt=canvasPt(e,canvas)
    const{type,layerId,layerType,startPt,startLayer,idx}=drag.current
    const dx=pt.x-startPt.x, dy=pt.y-startPt.y
    const xKey=layerType==='decoration'?'shapeX':'textX'
    const yKey=layerType==='decoration'?'shapeY':'textY'
    const wKey=layerType==='decoration'?'shapeW':'textW'
    const hKey=layerType==='decoration'?'shapeH':'textH'
    const rKey=layerType==='decoration'?'shapeRot':'textRot'

    if(type==='move'){
      onLayerChange&&onLayerChange('update',layerId,{
        [xKey]:(startLayer[xKey]??cx)+dx,
        [yKey]:(startLayer[yKey]??cy)+dy,
      })
    } else if(type==='rotate'){
      const sx=startLayer[xKey]??cx, sy=startLayer[yKey]??cy
      const a0=Math.atan2(startPt.y-sy,startPt.x-sx)
      const a1=Math.atan2(pt.y-sy,pt.x-sx)
      onLayerChange&&onLayerChange('update',layerId,{[rKey]:(startLayer[rKey]??0)+(a1-a0)})
    } else if(type==='scale'){
      const lrot=startLayer[rKey]??0
      const cos=Math.cos(-lrot),sin=Math.sin(-lrot)
      const ldx=dx*cos-dy*sin, ldy=dx*sin+dy*cos
      let nw=startLayer[wKey]??200, nh=startLayer[hKey]??200
      if([2,3,4].includes(idx)) nw=Math.max(20,nw+ldx*2)
      if([0,6,7].includes(idx)) nw=Math.max(20,nw-ldx*2)
      if([4,5,6].includes(idx)) nh=Math.max(20,nh+ldy*2)
      if([0,1,2].includes(idx)) nh=Math.max(20,nh-ldy*2)
      onLayerChange&&onLayerChange('update',layerId,{[wKey]:nw,[hKey]:nh})
    }
  },[cx,cy,onLayerChange])

  const handleMouseUp=useCallback(()=>{drag.current=null},[])

  const handleMouseMoveStyle=useCallback((e)=>{
    const canvas=canvasRef.current; if(!canvas) return
    const pt=canvasPt(e,canvas)
    const selected=layers?.find(l=>l.id===selectedId&&(l.type==='text'||l.type==='decoration'))
    if(selected){
      const defX=(selected.type==='decoration'?selected.shapeX:selected.textX)??cx
      const defY=(selected.type==='decoration'?selected.shapeY:selected.textY)??cy
      const{handles,rotHandle}=getHandles(selected,defX,defY)
      const hit=hitHandle(pt,handles,rotHandle)
      if(hit?.type==='rotate'){canvas.style.cursor='grab';return}
      if(hit?.type==='scale'){canvas.style.cursor='nwse-resize';return}
      if(ptInBox(pt,selected,defX,defY)){canvas.style.cursor='move';return}
    }
    const interactive=getInteractiveLayers()
    if(interactive.some(l=>ptInBox(pt,l,(l.type==='decoration'?l.shapeX:l.textX)??cx,(l.type==='decoration'?l.shapeY:l.textY)??cy))){canvas.style.cursor='move';return}
    canvas.style.cursor='default'
  },[layers,selectedId,cx,cy,getInteractiveLayers])

  useEffect(()=>{draw()},[draw])

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return
    canvas.addEventListener('mousedown',handleMouseDown)
    window.addEventListener('mousemove',handleMouseMove)
    window.addEventListener('mouseup',handleMouseUp)
    canvas.addEventListener('mousemove',handleMouseMoveStyle)
    return()=>{
      canvas.removeEventListener('mousedown',handleMouseDown)
      window.removeEventListener('mousemove',handleMouseMove)
      window.removeEventListener('mouseup',handleMouseUp)
      canvas.removeEventListener('mousemove',handleMouseMoveStyle)
    }
  },[handleMouseDown,handleMouseMove,handleMouseUp,handleMouseMoveStyle])

  return (
    <canvas ref={canvasRef} width={CW} height={CH}
      style={{width:CW*previewScale,height:CH*previewScale,filter:'drop-shadow(0 8px 32px rgba(0,0,0,0.85))',cursor:'default'}}
    />
  )
})

export default BadgeCanvas
