$(document).ready(function(){
  // Add smooth scrolling to all links
  $("a").on('click', function(event) {

    // Make sure this.hash has a value before overriding default behavior
    var lang = ['#en', '#es', '#ja'];
    // Check if the link is an external link
    var isExternal = this.href && this.href.startsWith('http') && !this.href.startsWith(window.location.origin);
    if (this.hash !== "" && !lang.includes(this.hash) && !isExternal) {
      // Prevent default anchor click behavior
      event.preventDefault();

      // Store hash
      var hash = this.hash;

      // Using jQuery's animate() method to add smooth page scroll
      // The optional number (800) specifies the number of milliseconds it takes to scroll to the specified area
      $('html, body').animate({
        scrollTop: $(hash).offset().top
      }, 800, function(){
   
        // Add hash (#) to URL when done scrolling (default click behavior)
        window.location.hash = hash;
      });
    } else if (isExternal) {
      return true;
    }
  });
});
