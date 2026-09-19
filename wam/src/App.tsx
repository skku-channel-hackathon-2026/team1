import { WamHeader, WamThemeProvider } from '@channel.io/app-sdk-wam-ui'
import { useWamClose, useWamData } from '@channel.io/app-sdk-wam'

import SameClass from './pages/SameClass'

function App() {
  const { close } = useWamClose()
  const dark = useWamData('appearance') === 'dark'

  return (
    <WamThemeProvider>
      <div
        className={dark ? 'sc sc--dark' : 'sc'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <WamHeader
          title="같은 반"
          onClose={close}
        />
        <div style={{ flex: 1, minHeight: 0 }}>
          <SameClass />
        </div>
      </div>
    </WamThemeProvider>
  )
}

export default App
