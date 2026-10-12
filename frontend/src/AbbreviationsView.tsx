import { ABBREVIATIONS } from './abbreviations.ts'

// The list is short and each row is big, so it's split in half and shown as two tables side by side (reading down the
// left one, then the right one) instead of one tall one
const HALF = Math.ceil(ABBREVIATIONS.length / 2)
const COLUMNS = [ABBREVIATIONS.slice(0, HALF), ABBREVIATIONS.slice(HALF)]

export function AbbreviationsView() {
  return (
    <section className="store">
      <div className="store-head">
        <h2 className="page-heading">Abbreviations</h2>
      </div>
      <div className="abbreviation-columns">
        {COLUMNS.map((column) => (
          <table key={column[0].abbr} className="items items-compact items-large">
            <thead>
              <tr>
                <th scope="col">Abbreviation</th>
                <th scope="col">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {column.map(({ abbr, meaning }) => (
                <tr key={abbr}>
                  <td>{abbr}</td>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  )
}
