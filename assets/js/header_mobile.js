document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('mobile-menu-button').addEventListener('click', handleMobileToggle);
  document.querySelectorAll('#mobile-menu-contents li a').forEach((element) => {
      element.addEventListener('click', handleMobileToggle);
  });
});

function handleMobileToggle(event) {
  event.preventDefault();

  var menuContainer = document.getElementById('mobile-menu-contents');

  menuContainer.classList.toggle('hidden');

  var menuIcon = document.querySelector('#mobile-menu-button > i');
  if (menuContainer.classList.contains('hidden')) {
    menuIcon.classList.replace('fa-times', 'fa-bars');
  } else {
    menuIcon.classList.replace('fa-bars', 'fa-times');
  }
}
