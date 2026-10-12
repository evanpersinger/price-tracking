interface AmountCellProps {
  amounts: string[] // like "8 buns" or "500g", from itemParts
}

// An item with two measurements (a count and a weight) splits the cell in half, like two cells inside one, see
// .amount-split in index.css
export function AmountCell({ amounts }: AmountCellProps) {
  if (amounts.length < 2) return <td className="amount">{amounts[0]}</td>
  return (
    <td className="amount amount-split">
      <span className="amount-chips">
        {amounts.map((amount) => (
          <span className="amount-chip" key={amount}>
            {amount}
          </span>
        ))}
      </span>
    </td>
  )
}
