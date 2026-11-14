/**
 * Table (bonus): first row is the header row, remaining rows are data.
 * Empty rows are skipped; ragged rows are kept as authored.
 * @param {Element} block
 */
export default function decorate(block) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tbody = document.createElement('tbody');

  const rows = [...block.children].filter((row) => row.children.length);
  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    [...row.children].forEach((cell) => {
      const td = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) td.setAttribute('scope', 'col');
      td.append(...cell.childNodes);
      tr.append(td);
    });
    if (i === 0) thead.append(tr);
    else tbody.append(tr);
  });

  if (thead.children.length) table.append(thead);
  table.append(tbody);
  block.replaceChildren(table);
}
