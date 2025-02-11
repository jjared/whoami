var links = {
    "LinkedIn": {
        "title": "LinkedIn",
        "url": "https://www.linkedin.com/in/james-jared/",
        "icon": "fa-solid fa-linkedin"
    },
    "Twitter": {
        "title": "Twitter",
        "url": "https://twitter.com/thecybergay",
        "icon": "fa-solid fa-twitter"
    },
    "GitHub": {
        "title": "GitHub",
        "url": "https://github.com/jjared",
        "icon": "fa-solid fa-github"
    }
};

var popout = location.pathname.split('/')[1];
var redirect = '';

for (var [key, link] of Object.entries(links)) {
    linkEl = document.createElement("a");
    linkEl.className = "link";
    if (popout == key) {
        linkEl.className = "link popout";
        redirect = link["url"]
    }
    linkEl.setAttribute("href", link["url"]);
    linkEl.setAttribute("target", "_blank");
    iconEl = document.createElement("i");
    iconEl.className = link["icon"];
    iconEl.innerHTML = "&nbsp;";
    linkEl.append(iconEl);
    linkEl.append(link["title"])
    document.getElementById("links").append(linkEl);
};

if (redirect) {
    setTimeout(() => {
        window.location.replace(redirect);
    }, 1500);
}