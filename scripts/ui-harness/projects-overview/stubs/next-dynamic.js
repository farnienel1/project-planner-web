import React from 'react'
export default function dynamic(loader) {
  return function Dyn(props) {
    const [C, setC] = React.useState(null)
    React.useEffect(() => {
      Promise.resolve(loader()).then((m) => setC(() => m.default || m))
    }, [])
    return C ? React.createElement(C, props) : null
  }
}
