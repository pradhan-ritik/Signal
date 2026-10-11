import { useState } from 'react'
import { findPlace, roundPlace, type Place } from './localResources'

type Props = { place: Place | null; onPlace: (place: Place | null) => void }

// Asks where the user is, so nearby places can be shown. Sharing a location is optional:
// a ZIP code or city works too, and either way only a rounded position is kept.
function LocationBar({ place, onPlace }: Props) {
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')

  function useMyLocation() {
    setMessage('Asking your browser…')
    navigator.geolocation.getCurrentPosition(
      (position) => (setMessage(''), onPlace(roundPlace('you', position.coords.latitude, position.coords.longitude))),
      () => setMessage('Location is off or was declined. Enter a ZIP code or city instead.'),
    )
  }

  async function search(event: React.FormEvent) {
    event.preventDefault()
    if (!query.trim()) return
    setMessage('Looking that up…')
    const found = await findPlace(query.trim()).catch(() => null)
    setMessage(found ? '' : 'Could not find that place. Try a 5-digit ZIP code.')
    if (found) onPlace(found)
  }

  if (place) {
    return (
      <div className="signal-location">
        <p>
          Showing help near <strong>{place.label}</strong>
        </p>
        <button type="button" className="signal-link" onClick={() => onPlace(null)}>
          Change location
        </button>
      </div>
    )
  }

  return (
    <form className="signal-location" onSubmit={search}>
      <p>Find real places near you</p>
      <button type="button" className="signal-btn signal-btn--quiet" onClick={useMyLocation}>
        Use my location
      </button>
      <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="ZIP code or city" placeholder="or ZIP code or city" />
      <button type="submit" className="signal-btn signal-btn--quiet" disabled={!query.trim()}>
        Find help nearby
      </button>
      {message && (
        <p className="signal-caption" role="status">
          {message}
        </p>
      )}
    </form>
  )
}

export default LocationBar
