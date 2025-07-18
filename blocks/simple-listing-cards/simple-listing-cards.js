export default function decorate(block) {
  // Store original content before clearing
  const originalChildren = [...block.children];

  // Clear and set up the structure
  block.innerHTML = '<ul class="listing-cards"></ul>';
  const ul = block.querySelector('ul');

  originalChildren.forEach((row) => {
    const div = document.createElement('div');
    div.className = 'listing-card';

    [...row.children].forEach((child) => {
      if (child.textContent.trim()) {
        const p = document.createElement('p');
        p.textContent = child.textContent.trim();

        if (!div.querySelector('.listing-card-title')) {
          p.className = 'listing-card-title';
        } else {
          p.className = 'listing-card-description';
        }

        div.append(p);
      }
    });

    if (div.children.length > 0) {
      ul.append(div);
    }
  });
}
