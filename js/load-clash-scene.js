// Load the interactive preview only as its section approaches the viewport.
const hosts = [...document.querySelectorAll('.scene-3d')];
if (hosts.length) {
  let loading;
  const load = () => {
    if (!loading) {
      loading = import('./clash-scene.js').catch(error => {
        loading = undefined;
        console.error('Unable to load the 3D preview', error);
      });
    }
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        load();
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    hosts.forEach(host => observer.observe(host));
  } else {
    load();
  }
}
