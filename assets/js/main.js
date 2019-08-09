/*
	Epilogue by TEMPLATED
	templated.co @templatedco
	Released for free under the Creative Commons Attribution 3.0 license (templated.co/license)
*/

Sticker.init('.sticker');

(function($) {

	skel.breakpoints({
		xlarge: '(max-width: 1680px)',
		large: '(max-width: 1280px)',
		medium: '(max-width: 980px)',
		small: '(max-width: 736px)',
		xsmall: '(max-width: 480px)',
		xxsmall: '(max-width: 360px)'
	});

	$(function() {

		var	$window = $(window),
			$body = $('body');

		// Disable animations/transitions until the page has loaded.
			$body.addClass('is-loading');

			$window.on('load', function() {
				window.setTimeout(function() {
					$body.removeClass('is-loading');
				}, 100);
			});

		// Fix: Placeholder polyfill.
			$('form').placeholder();

		// Prioritize "important" elements on medium.
			skel.on('+medium -medium', function() {
				$.prioritize(
					'.important\\28 medium\\29',
					skel.breakpoint('medium').active
				);
			});

		// Items.
			$('.item').each(function() {

				var $this = $(this),
					$header = $this.find('header'),
					$a = $header.find('a'),
					$img = $header.find('img');

				// Set background.
					$a.css('background-image', 'url(' + $img.attr('src') + ')');

				// Remove original image.
					$img.remove();

			});

	});

})(jQuery);

function dont() {
	$('#networks').css('display', 'inline-block');
	//$('#networks').css('visibility', 'visible');
	$('.needless').css('text-decoration', 'line-through rgb(160,0,0)');
}

var languages = ['en', 'es', 'ja', 'zh'];
var chosen_language = 'en';
changeLanguage(window.location.hash ? window.location.hash.substr(1) : 'en');
function changeLanguage(option) { // Changes language to option
	option = (languages.includes(option) ? option : 'en'); // If reload with non-language hash, load English page
	for (var i = 0; i < languages.length; i++) {
		if (languages[i] != option) {
			$('[lang="' + languages[i] + '"]').hide();
		}
		else {
			chosen_language = languages[i];
			$('[lang="' + languages[i] + '"]').show();			
		}
	}
}
function fillLanguages(fillers) { // Fills all language-dependent fields using the fillers
	var keys = Object.keys(fillers);
	for (var i = 0; i < keys.length; i++) {
		switch (fillers[keys[i]]["type"]) {
			case "text": $("#" + keys[i]).text(fillers[keys[i]][chosen_language]); break;
			case "html": $("#" + keys[i]).html(fillers[keys[i]][chosen_language]); break;
			default: $("#" + keys[i]).attr(fillers[keys[i]]["type"], fillers[keys[i]][chosen_language]);
		}
	}
}
var languages_flags = {
	"en": {"en": "English", "es": "inglés", "ja": "英語"},
	"es": {"en": "Spanish", "es": "español", "ja": "スペイン語"},
	"ja": {"en": "Japanese", "es": "japonés", "ja": "日本語"},
	"fr": {"en": "French", "es": "francés", "ja": "フランス語"},
	"pt": {"en": "Portuguese", "es": "portugués", "ja": "ポルトガル語"},
	"it": {"en": "Italian", "es": "italiano", "ja": "イタリア語"},
	"nl": {"en": "Dutch", "es": "holandés", "ja": "オランダ語"}};
function setTitle(ori, tar) { // Sets language title
	var prev = (ori == "ja" ? "（" : "(" + (ori == "es" ? "En " : "In "));
	var post = (ori == "ja" ? "で）" : ")");
	return prev + languages_flags[tar][ori] + post;
}