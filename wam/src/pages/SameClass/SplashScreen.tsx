/**
 * Opening screen. Shows while the WAM boots (profile + recommendations) and for a short
 * minimum beat afterwards, so the app never flashes a blank frame on a fast connection.
 */
export function SplashScreen() {
  return (
    <div className="sc-splash">
      <img
        className="sc-splash__icon"
        src="./icon-256.png"
        alt=""
        width={96}
        height={96}
      />
      <h1 className="sc-splash__title">같은 반</h1>
      <p className="sc-splash__tagline">대학에도 반이 있었다면</p>
      <div
        className="sc-splash__bar"
        role="progressbar"
        aria-label="불러오는 중"
      >
        <span />
      </div>
    </div>
  )
}
