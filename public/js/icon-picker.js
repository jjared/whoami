import freeIcons from "../vendor/icons.js";

export function createIconPicker(search, options, emptyMessage) {
    const fragment = document.createDocumentFragment();
    for (const { label, className, search: searchTerms } of freeIcons) {
        const option = document.createElement("label");
        option.className = "icon-option";
        option.title = label;
        option.dataset.name = searchTerms;
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "icon";
        radio.value = className;
        radio.checked = className === "fa-solid fa-link";
        radio.defaultChecked = radio.checked;
        radio.setAttribute("aria-label", label);
        const symbol = document.createElement("i");
        symbol.className = className;
        symbol.setAttribute("aria-hidden", "true");
        option.append(radio, symbol);
        fragment.append(option);
    }
    options.append(fragment);

    function filter() {
        const query = search.value.trim().toLowerCase();
        for (const option of options.children) {
            option.hidden = !option.dataset.name.includes(query);
        }
        emptyMessage.hidden = [...options.children].some(option => !option.hidden);
    }

    search.addEventListener("input", filter);
    return { reset: filter };
}