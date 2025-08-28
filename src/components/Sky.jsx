// Компонент: src/components/Sky.jsx — пиксельное небо с облаками
import React from 'react'

const Sky = () => {
  return (
    <div className="sky" aria-hidden="true">
      <div className="pixel cloud small"  style={{ '--left': '12%', '--top': '18%' }} />
      <div className="pixel cloud medium" style={{ '--left': '28%', '--top': '22%', '--size': '1.6' }} />
      <div className="pixel cloud small"  style={{ '--left': '50%', '--top': '12%', '--size': '1.0' }} />
      <div className="pixel cloud large"  style={{ '--left': '72%', '--top': '25%', '--size': '2.2' }} />
      <div className="pixel cloud medium" style={{ '--left': '85%', '--top': '8%',  '--size': '1.3' }} />
      {/* Дополнительное облако для наглядности/отладки */}
      <div className="pixel cloud large"  style={{ '--left': '42%', '--top': '30%', '--size': '3.0' }} />
      <div className="horizon" />
    </div>
  )
}

export default Sky
