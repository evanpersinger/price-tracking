import { ABBREVIATIONS } from './abbreviations.ts'

export function AbbreviationsView() {
  return (
    <section className="store">
      <div className="store-head">
        <h2 className="page-heading">Abbreviations</h2>
      </div>
      <table className="items">
        <thead>
          <tr>
            <th scope="col">Abbreviation</th>
            <th scope="col">Meaning</th>
          </tr>
        </thead>
        <tbody>
          {ABBREVIATIONS.map(({ abbr, meaning }) => (
            <tr key={abbr}>
              <td>{abbr}</td>
              <td>{meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
