import ReactDOM from 'react-dom/client'
import { WamProvider } from '@channel.io/app-sdk-wam'

import App from './App.tsx'
import '@channel.io/bezier-react/styles.css'
import './index.css'

async function bootstrap() {
  // `vite` dev without Desk: install a local host so the whole flow runs in the browser.
  if (import.meta.env.DEV && window.ChannelIOWam === undefined) {
    await import('./local/mockHost')
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <WamProvider>
      <App />
    </WamProvider>
  )
}

void bootstrap()
