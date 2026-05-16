import { useEffect, useState } from 'react'

const PHRASES = [
  'Denkt nach…',
  'Ruft universelle Kräfte…',
  'Konsultiert die Wissensdatenbank…',
  'Aktiviert neuronale Pfade…',
  'Polishs Gedankenstrukturen…',
  'Befragt das Multiversum…',
  'Verbindet die Punkte…',
  'Stöbert in der Bibliothek von Alexandria…',
  'Bricht das Problem in Atome…',
  'Justiert Quantenwahrscheinlichkeiten…',
  'Stimmt Hermes-Gedanken ab…',
  'Sammelt Indizien…',
  'Dekompiliert deine Frage…',
  'Kompiliert eine Antwort…',
  'Beratet sich mit Tokens…',
  'Frischt das Modell auf…',
  'Synthetisiert die beste Antwort…',
  'Mustert die Trainingsdaten…',
  'Wägt Möglichkeiten ab…',
  'Verfeinert die Formulierung…',
  'Geht die Quellen durch…',
  'Versammelt die Worte…',
  'Räumt das Gedankengewicht auf…',
  'Schickt Signale durch die Layer…',
  'Sucht nach Mustern…',
  'Kalibriert Aufmerksamkeitsköpfe…',
  'Verfolgt logische Spuren…',
  'Webt eine Antwort…',
  'Holt sich Inspiration…',
  'Trainiert kurz nach…',
]

export function ThinkingStatus() {
  const [phrase, setPhrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)])
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => (t + 1) % 4), 350)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="thinking-status">
      <span aria-hidden className="inline-flex w-5 font-mono tabular-nums">
        {'.'.repeat(tick)}
      </span>
      <span className="italic">{phrase}</span>
    </div>
  )
}
