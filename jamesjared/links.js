var links = {
    "odcclass": {
        "title": "Beg Heels Technique Signup: Tuesday 7:30pm @ODC",
        "url": "https://clients.mindbodyonline.com/classic/ws?studioid=2717&stype=-112&sView=week&sLoc=0&sTrn=100001628&date=09/03/24",
        "icon": "fa-solid fa-file-signature"
    },
    "raeclass": {
        "title": "Adv Heels Signup: Wednesday 7:45pm @Rae",
        "url": "https://clients.mindbodyonline.com/classic/ws?studioid=141475&stype=-7&sView=week&sLoc=0&sTrn=100000416",
        "icon": "fa-solid fa-file-signature"
    },
    "faq": {
        "title": "Beginner's Guide to Heels",
        "url": "https://www.steezy.co/posts/how-to-dance-confidently-in-heels",
        "icon": "fa-solid fa-clipboard-question"
    },
    // "classvids": {
    //     "title": "Class Vids",
    //     "url": "https://drive.google.com/drive/folders/1L8BN6TwfZJnqCYBZRa2ICI5uJJj1lmcZ?usp=sharing",
    //     "icon": "fa-solid fa-video"
    // },
    "choreoplaylist": {
        "title": "Choreo Playlist",
        "url": "https://open.spotify.com/playlist/5MfC4Ia0R0zRjMh4nEhX5W?si=1cc8329f599c4b0c",
        "icon": "fa-solid fa-music"
    },
    "instagram": {
        "title": "Instagram",
        "url": "https://www.instagram.com/jams_jard",
        "icon": "fab fa-instagram"
    },
    "twitter": {
        "title": "X (Twitter)",
        "url": "https://twitter.com/jams_jard",
        "icon": "fab fa-x-twitter"
    },
    "tiktok": {
        "title": "TikTok",
        "url": "https://www.tiktok.com/@jamsjard",
        "icon": "fab fa-tiktok"
    },
    "bluesky": {
        "title": "Bluesky",
        "url": "https://bsky.app/profile/jamsjard.bsky.social",
        "icon": "fab fa-bluesky"
    },
    "bingo": {
        "title": "Drag Race Bingo",
        "url": "http://jamesjared.com/bingo",
        "icon": "fa-solid fa-chess-board"
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