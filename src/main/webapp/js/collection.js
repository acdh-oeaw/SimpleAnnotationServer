var userCollections = null;
var activeCollection = null;
function initCollections(active, callback=null) {
    // Get collections list store it and generate menu
    var collectionsUL = document.getElementById('collections'); 

    $.ajax({
        url: 'collection/all.json',
        type: 'GET',
        success: function(data) {
            userCollections = {};
            collectionsUL.innerHTML = '';
            activeCollection = null;
            for (var index in data.collections) {
                var tCollection = data.collections[index];
                var id = tCollection["@id"];
                userCollections[id] = tCollection;
                var li = document.createElement("li");
                li.dataset.id = id;
                if (id.endsWith(active)) {
                    activeCollection = tCollection;
                    li.className = "active";
                }
                var anchor = document.createElement("a")
                anchor.innerHTML = tCollection.label;
                anchor.href= tCollection['@id'];
                anchor.onclick = showCollection;
                li.appendChild(anchor);
                collectionsUL.appendChild(li);
            }
            $("#scroll").mCustomScrollbar('update');
            if (activeCollection == null) {
                activeCollection = data.collections[0];
            }
            updateCollectionView();
            if (callback != null) {
                callback();
            }
        },
        error: function(data) {
            console.log('Failed to load collection: ' + data);
        }
    });
}

function deleteCollection() {
    setLoading("confirmButton", "Deleting");
    
    let confirmId = document.getElementById('confirmId');
    console.log('Deleting: ' + confirmId.value);
    $.ajax({
        url: confirmId.value,
        type: 'DELETE',
        success: function(data) {
            showMessage("confirmInfoMessage", "info", "Deleted Collection succesfully.");
            
            clearLoading("confirmButton", "Confirm");
            $('#confirm').modal('toggle');
            window.location.href = 'collections.xhtml';
        },
        error: function(data) {
            clearLoading("confirmButton", "Confirm");
            if (data.responseJSON) {
                if ("reason" in data.responseJSON) {
                    message = "Failed to delete collection due to: " + data.responseJSON.reason;
                } else if ("message" in data.responseJSON) {
                    message = data.responseJSON.message;
                } else {
                    message = "Failed to delete collection.";
                }
            } else if ("statusText" in data) {    
                message = "Failed to delete collection due to: " + data.statusText;
            } else {
                message = "Failed to delete collection.";
            }
            showMessage("confirmInfoMessage", "error", message);
        }
    });
}

function addAction(parentEl, text, onClick) { 
    var ul = document.getElementById("actions");
    var li = document.createElement("li");
    var anchor = document.createElement("a")
    anchor.innerHTML = text;
    anchor.href= "#";
    anchor.onclick = onClick;
    li.appendChild(anchor);
    ul.appendChild(li);
}

function showCollection(event) {
    event.preventDefault();
    var collectionsUL = document.getElementById('collections'); 
    var items = collectionsUL.getElementsByTagName("li");
    for (var i = 0; i < items.length; ++i) {
        items[i].className = '';
    }
    event.srcElement.parentNode.className = 'active';
    activeCollection =  userCollections[event.srcElement.href];
    updateCollectionView();
    return false;
}
function updateCollectionView() {
    var heading = document.getElementById("collectionName");
    heading.innerHTML = "Collection";//activeCollection.label;
    /*var openAll = document.getElementById("openAll");
    openAll.href = "view.xhtml?collection=" + activeCollection["@id"];
*/
    var deleteCollection = document.getElementById("deleteCollection");
    if (activeCollection["@id"].endsWith("inbox.json")) {
        deleteCollection.style.display = "none";
    } else {
        deleteCollection.style.display = "inline-block";
    }
    var collectionLink = document.getElementById("collection_link");
    collection_link.innerHTML = "<b>Name: </b>" + activeCollection.label + "<br/><b>Collection link: </b> <span class=\"form-control\" type=\"text\" placeholder=\"" + activeCollection["@id"] + "\" readonly> " + activeCollection["@id"] + "</span>";
    collection_link.appendChild(setupContentState(activeCollection["@id"], "Link to collection. Also draggable using IIIF Content State."));

    var manifestsUl = document.getElementById("manifests");
    manifestsUl.innerHTML ='';
    if ('manifests' in activeCollection) { 
        for (var index in activeCollection.manifests) {
            var manifest = activeCollection.manifests[index];
            if ('@context' in manifest) {
                showManifestDiv(manifestsUl, manifest);
            } else {
                // Need to retrieve Manifest
                $.ajax({
                    url: manifest["@id"],
                    type: 'GET',
                    success: function(manifest) {
                        for (var index in activeCollection.manifests) {
                            if (activeCollection.manifests[index]["@id"] === manifest["@id"]) {
                                activeCollection.manifests[index] = manifest;
                            }
                        }
                        showManifestDiv(manifestsUl, manifest);
                    },
                    error: function(data) {
                        console.log('Failed to load manifest: ' + data);
                    }
                });
            }
                            
        }
    }
}

function populateManifest(url, shortId) {
    fetch(url, {
        method: 'GET', // or 'PUT'
    })
    .then(response => response.json())
    .then(manifest => {
        let thumbnail_img = "";
        if ('thumbnail' in manifest && manifest.thumbnail) {
            if (typeof manifest.thumbnail === 'string' || manifest.thumbnail instanceof String) {
                thumbnail_img = manifest.thumbnail;
            } else if (typeof manifest.thumbnail === 'object' && !Array.isArray(manifest.thumbnail)){
                thumbnail_img = manifest.thumbnail['@id'];
            }
        } else {
            // Get image service from first canvas
            if (manifest.sequences && Array.isArray(manifest.sequences) && manifest.sequences[0].canvases && Array.isArray(manifest.sequences[0].canvases)) {
                var imageId = manifest.sequences[0].canvases[0]["@id"];
                thumbnail_img = getCanvasThumbnail(manifest, imageId, 0, 100);
            }
        }
        let thumb = document.getElementById("thum-" + shortId);
        thumb.src = thumbnail_img;

        if ('logo' in manifest) {
            let tURL = "";
            if (typeof manifest.logo === 'object' && '@id' in manifest.logo) {
                tURL = manifest.logo['@id'];
            } else if (typeof manifest.logo === 'string') {
                tURL = manifest.logo;
            }
            if (tURL) {
                let logo = document.getElementById("logo-" + shortId);
                logo.src = tURL;
            }
        }
        if ('description' in manifest && manifest.description) {
            let desc = document.getElementById("desc-" + shortId);
            desc.innerHTML = manifest.description;
        }

        if ('attribution' in manifest && manifest.attribution) {
            let attr = document.getElementById("attr-" + shortId);
            attr.innerHTML = manifest.attribution;
        }

    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function moveManifest() {
    setLoading("movebutton", "Moving");
    var select = document.getElementById("collectionSelect");
    var newCollectionId = select.options[select.selectedIndex].value;
    
    var manifestEl = document.getElementById("manifestURI");
    var manifestURL = manifestEl.value;

    let fromCollection = document.getElementById("fromCollection");

    $.ajax({
        url: '/collection/',
        data: JSON.stringify({
            "from": fromCollection.value,
            "to": newCollectionId,
            "manifest": manifestURL
        }),
        type: 'PUT',
        contentType: "application/json",
        processData: false,
        success: function(data) {
            showMessage("moveMessage", "info", "Succesfully moved manifest.");
            $('#moveManifest').modal('toggle');
            clearLoading("movebutton", "Move");
            hideMessage("moveMessage");
            window.location.href = 'collections.xhtml?collection=' + fromCollection.value;
        },
        error: function(data) {
            clearLoading("movebutton", "Move");
            if (data.responseJSON) {
                if ("reason" in data.responseJSON) {
                    message = "Failed to move collection due to: " + data.responseJSON.reason;
                } else if ("message" in data.responseJSON) {
                    message = data.responseJSON.message;
                } else {
                    message = "Failed to move collection.";
                }
            } else if ("statusText" in data) {    
                message = "Failed to move collection due to: " + data.statusText;
            } else {
                message = "Failed to move collection.";
            }
            showMessage("moveMessage", "error", message);
        }
    });

}

function deleteManifest() {
    setLoading("confirmButton", "Deleting");
    var manifestURL = document.getElementById("confirmId").value;
    var collection = document.getElementById('from-collection').value;
    
    $.ajax({
        url: '/collection/',
        data: JSON.stringify({
            "from": collection,
            "manifest": manifestURL
        }),
        type: 'PUT',
        contentType: "application/json",
        processData: false,
        success: function(data) {
            showMessage("confirmInfoMessage", "info", "Removed manifest from collection succesfully.");
            $("#scroll").mCustomScrollbar('update');
            clearLoading("confirmButton", "Confirm");
            $('#confirm').modal('toggle');

            window.location.href = 'collections.xhtml?collection=' + collection;
        },
        error: function(data) {
            clearLoading("confirmButton", "Confirm");
            if (data.responseJSON) {
                if ("reason" in data.responseJSON) {
                    message = "Failed to delete collection due to: " + data.responseJSON.reason;
                } else if ("message" in data.responseJSON) {
                    message = data.responseJSON.message;
                } else {
                    message = "Failed to delete collection.";
                }
            } else if ("statusText" in data) {    
                message = "Failed to delete collection due to: " + data.statusText;
            } else {
                message = "Failed to delete collection.";
            }
            showMessage("confirmInfoMessage", "error", message);
        }
    });

}


function showConfirm(event) {
    hideMessage("confirmInfoMessage", "Confirm");
    var header = document.getElementById("confirmTitle");
    var text = document.getElementById("confirmText");
    var id = document.getElementById("confirmId");
    var confirmButton = document.getElementById("confirmButton");

    mode = event.srcElement.dataset.mode;
    let dataEl = event.srcElement;
    if (!mode) {
        mode = event.srcElement.parentElement.dataset.mode;
        dataEl = event.srcElement.parentElement;
    }

    if (mode === 'delete_collection') {
        header.innerHTML = 'Delete "' + dataEl.dataset.label + '"';
        text.innerHTML = 'Are you sure you want to delete this collection?';
        id.value = dataEl.dataset.url;

        confirmButton.onclick = deleteCollection;
    } else if (mode === 'remove_manifest') {
        header.innerHTML = 'Remove manifest';
        text.innerHTML = 'Are you sure you want to remove the manifest: <p><i>"' + dataEl.dataset.label + '"</i></p> from the collection "' + dataEl.dataset.collectionLabel + '"?';
        id.value = dataEl.dataset.manifest;

        let input = null;
        if (document.getElementById('from-collection') != null) {
            input = document.getElementById('from-collection');
        } else {
            input = document.createElement("input");
            input.type = "hidden";
            input.id = "from-collection";
            let form = document.getElementById("collection_form");
            form.appendChild(input);
        }
        input.value = dataEl.dataset.collectionId;

        confirmButton.onclick = deleteManifest;
    }

    $('#confirm').modal('toggle');
}

function showMoveManifest(event) {
    hideMessage("moveMessage");
    let dataEl = null;
    if (event.srcElement.dataset.manifestId) {
        dataEl = event.srcElement;
    } else {
        dataEl = event.srcElement.parentElement;
    }

    let manifestEl = document.getElementById("manifestURI");
    manifestEl.value = dataEl.dataset.manifestId;

    let tLabelEl = document.getElementById("manifestLabel");
    tLabelEl.innerHTML = dataEl.dataset.manifestLabel;

    let tCollectionEl = document.getElementById("fromCollection");
    tCollectionEl.value = dataEl.dataset.collectionId;

    $('#moveManifest').modal('toggle');
}

function findValue(parentnode, key) {
    var response = '';
    if (typeof parentnode[key] === 'object' && !Array.isArray(parentnode[key]) && parentnode[key]["@value"]) {
        response = parentnode[key]["@value"];
    } else if (Array.isArray(parentnode[key]) && parentnode[key].length > 0) {
        if (typeof parentnode[key][0] === 'string') {
            response = parentnode[key][0];
        } else {
            // attribution is a list of objects
            if (parentnode[key][0]["@value"]) {
                response = parentnode[key][0]["@value"];
            }
        }
    } else if (typeof parentnode[key] === 'string') {
        response = parentnode[key];
    }
    return response;
}

function isObject(object) {
    return typeof object === 'object' && !Array.isArray(object);
}

function hasCanvases(manifest) {
    return manifest.sequences && Array.isArray(manifest.sequences) && manifest.sequences[0].canvases && Array.isArray(manifest.sequences[0].canvases);
}

/* 
 * Get thumbnail URL from canvas with canvas_id
 * canvas_id can contain a fragement
 * image returned will be the same size as desired_width and height or bigger
 * zero means discount axis. 
 */
function getCanvasThumbnail(manifest, canvas_id, desired_width, desired_height) {
    let canvasId = canvas_id;
    let hasFragment = false;
    let fragment = '';
    if (canvasId.includes("#xywh")) {
        canvasId = canvas_id.split("#")[0]
        fragment = canvas_id.split("#")[1]
        hasFragment = true;
    }
    if (hasCanvases(manifest)) {
        let canvas = manifest.sequences[0].canvases.find(canvas => canvas["@id"] === canvasId);

        // First try canvas thumbnail
        if (!hasFragment && 'thumbnail' in canvas && isObject(canvas.thumbnail)) {
            if ('width' in canvas.thumbnail && 'height' in canvas.thumbnail) {
                if (canvas.thumbnail.width > desired_width && canvas.thumbnail.height > desired_height) {
                    return canvas.thumbnail["@id"];
                }
            }
        }

        // Next try first image
        if ('images' in canvas && Array.isArray(canvas.images)
                 && 'resource' in canvas.images[0] && typeof canvas.images[0].resource === 'object') {
            if ('service' in canvas.images[0].resource && typeof canvas.images[0].resource.service === 'object'
                        && '@id' in canvas.images[0].resource.service && typeof canvas.images[0].resource.service["@id"] === 'string') {

                let imageService = canvas.images[0].resource.service;
                let isLevel0 = false;
                if ('profile' in imageService && Array.isArray(imageService.profile)) {
                    imageService.profile.forEach(function(value) {
                        if (typeof key === 'string' && key === "http://iiif.io/api/image/2/level0.json") {
                            isLevel0 = true;
                        }
                    });
                }

                let imageId = imageService["@id"];

                var region = "full";
                // Return fragment region but not for level0 as this isn't supported.
                if (hasFragment && !isLevel0) {
                    //xywh=100,100,100,100
                    region = fragment.split("=")[1]; 
                }

                let size = "";
                if (!isLevel0) {
                    let widthStr = "";
                    let heightStr = "";
                    if (desired_width != 0) {
                        widthStr = "" + desired_width;
                    }
                    if (desired_height != 0) {
                        heightStr = "" + desired_height;
                    }
                    size = widthStr + "," + heightStr;
                } else {
                    // Find size that is bigger than the one we want. 
                    if ('sizes' in imageService && Array.isArray(imageService.sizes)) {
                        smallest_width = imageService.width;
                        smallest_height = imageService.height;

                        imageService.sizes.foreach(function(sizeOption) {
                            if ('width' in sizeOption && 'height' in sizeOption) {
                                if (sizeOption.width < smallest_width && sizeOption.height < smallest_height) {
                                    smallest_width = sizeOption.width;
                                    smallest_height = sizeOption.height;
                                }
                            }
                        });

                        size = "" + smallest_width + "," + smallest_height;
                    } else {
                        // No sizes so just have to use full 
                        size = "full";
                    }
                }

                return imageId + '/' + region + '/' + size + '/0/default.jpg';
            } else {
                // No image service so just return image. Really this should have a thumbnail
                return canvas.images[0].resource["@id"];
            }
        }
    }
}

function showManifestDiv(ul, manifest) {
    var li = document.createElement("li");
    li.className = "manifestSummary";

    var thumbnail_img = "";
    if ('thumbnail' in manifest && manifest.thumbnail) {
        if (typeof manifest.thumbnail === 'string' || manifest.thumbnail instanceof String) {
            thumbnail_img = manifest.thumbnail;
        } else if (typeof manifest.thumbnail === 'object' && !Array.isArray(manifest.thumbnail)){
            thumbnail_img = manifest.thumbnail['@id'];
        }
    } else {
        // Get image service from first canvas
        if (manifest.sequences && Array.isArray(manifest.sequences) && manifest.sequences[0].canvases && Array.isArray(manifest.sequences[0].canvases)) {
            var imageId = manifest.sequences[0].canvases[0]["@id"];
            thumbnail_img = getCanvasThumbnail(manifest, imageId, 0, 100);
        }
    }
    
    var img = document.createElement("img");
    img.className = "align-self-center mr-3 media-img";
    img.src = thumbnail_img;

    openImg = document.createElement("a");
    openImg.href = "view.xhtml?collection=" + activeCollection["@id"] + "&manifest=" + manifest["@id"];
    openImg.className = "align-self-center";
    openImg.appendChild(img);


    mediaHeaderDiv= document.createElement("div");
    mediaHeaderDiv.className = "media-header-div";

    mediaBody = document.createElement("div");
    mediaBody.className = "media-body";

    remove = document.createElement("button");
    remove.type = "button";
    remove.className = "close";
    remove.innerHTML = "<i class='far fa-window-close'></i>";
    remove.setAttribute('aria-hidden', 'true');
    remove.dataset.mode = 'remove_manifest';
    remove.dataset.manifest = manifest["@id"];
    remove.onclick = showConfirm;
   // mediaBody.appendChild(remove);

    mediaHeader = document.createElement("div");
    mediaHeader.className = "media-heading";

    heading = document.createElement("h5");
    mediaHeader.appendChild(heading);
    if ('label' in manifest && manifest.label) {
        heading.innerHTML = findValue(manifest, "label");
    } else {
        heading.innerHTML = "Missing Manifest label";
    }
    //mediaBody.appendChild(mediaHeader);

    if ('description' in manifest && manifest.description) {
        mediaContent = document.createElement("p");
        mediaContent.className = "";
        mediaContent.innerHTML = findValue(manifest, "description");
        mediaBody.appendChild(mediaContent);
    }

    if ('attribution' in manifest && manifest.attribution) {
        var attribution = findValue(manifest, "attribution");

        mediaContent = document.createElement("p");
        mediaContent.className = "";
        mediaContent.innerHTML = attribution;
        mediaBody.appendChild(mediaContent);
    }

    actionsBar = document.createElement("div");
    actionsBar.id = "actionBar";
    mediaBody.appendChild(actionsBar);

    actionsBar.appendChild(setupContentState(manifest["@id"], "Link to manifest. Also draggable using IIIF Content State."));

    open = document.createElement("a");
    open.href = "view.xhtml?collection=" + activeCollection["@id"] + "&manifest=" + manifest["@id"];
    open.className = "btn  btn-secondary mb-2";
    open.innerHTML = '<i class="far fa-edit"></i>';//"Open";
    open.title = "Open manifest for editing";
    actionsBar.appendChild(open);

    move = document.createElement("button");
    move.type = "button";
    move.className = "btn btn-secondary mb-2";
    move.innerHTML = '<i class="far fa-folder-open"></i>';
    move.title = "Move manifest to another collection.";
    move.onclick = showMoveManifest;
    move.dataset.manifest = manifest["@id"];
    actionsBar.appendChild(move);

    download = document.createElement("a");
    download.href = "manifest.xhtml?iiif-content=" + manifest["@id"] + "&collection=" + activeCollection["@id"];
    download.className = "btn btn-secondary mb-2";
    download.innerHTML = '<i class="fas fa-cloud-download-alt"></i>';
    download.title = "Export";
    actionsBar.appendChild(download);

    analytics = document.createElement("a");
    analytics.href = "stats/manifest.xhtml?iiif-content=" + manifest["@id"];
    analytics.className = "btn btn-secondary mb-2";
    analytics.innerHTML = '<i class="fas fa-chart-line"></i>';
    analytics.title = "Analytics";
    actionsBar.appendChild(analytics);


    if ('logo' in manifest) {
        var tURL = "";
        if (typeof manifest.logo === 'object' && '@id' in manifest.logo) {
            tURL = manifest.logo['@id'];
        } else if (typeof manifest.logo === 'string') {
            tURL = manifest.logo;
        }
        if (tURL) {
            var logo = document.createElement("img");
            logo.className = "logo";
            logo.src= tURL;
            /*actionsBar.appendChild(logo);
            mediaHeaderDiv.appendChild(logo)*/

           /* logoBar = document.createElement("div");
            logoBar.id = "logoBar";
            mediaBody.appendChild(logoBar);
            logoBar.appendChild(logo);*/
            mediaHeader.insertBefore(logo, mediaHeader.childNodes[0]);
        }

    }
    mediaHeaderDiv.appendChild(remove)

   // mediaBody.appendChild(remove);
    //mediaBody.appendChild(mediaHeader);

    cardDiv = document.createElement("div");
    cardDiv.className = "media";
    cardDiv.appendChild(openImg);
    cardDiv.appendChild(mediaBody);

    li.appendChild(mediaHeaderDiv);
    li.appendChild(mediaHeader)
    li.appendChild(cardDiv);
    ul.appendChild(li);
}

function createCollection() {
    setLoading("createCollectionbutton", "Creating");
    $.ajax({
        url: '/collection/',
        data: $("#collection_form").serialize(),
        type: 'POST',
        success: function(data) {
            showMessage("createCollectionMessage", "info", "Created collection succesfully.");

            clearLoading("createCollectionbutton", "Create");
            $('#createCollection').modal('toggle');
            window.location.href = 'collections.xhtml?collection=' + data['@id'];
        },
        error: function(data) {
            clearLoading("createCollectionbutton", "Create");
            if (data.responseJSON) {
                if ("reason" in data.responseJSON) {
                    message = "Failed to add collection due to: " + data.responseJSON.reason;
                } else if ("message" in data.responseJSON) {
                    message = "Failed to add collection due to: " + data.responseJSON.message;
                } else {
                    message = "Failed to add collection.";
                }
            } else if ("statusText" in data) {    
                message = "Failed to add collection due to: " + data.statusText;
            } else {
                message = "Failed to add collection.";
            }
            showMessage("createCollectionMessage", "error", message);
            console.log('Failed to load collection: ' + data);
        }
    });
}

function renameCollection() {
    setLoading("renameCollectionMessage", "Renaming");
    $.ajax({
        url: '/collection/',
        data: $("#rename_form").serialize(),
        type: 'PUT',
        success: function(data) {
            showMessage("renameCollectionMessage", "info", "Renamed collection succesfully.");

            clearLoading("renameCollectionbutton", "Rename");
            $('#renameCollection').modal('toggle');
            window.location.href = 'collections.xhtml?collection=' + data['@id'];
        },
        error: function(data) {
            clearLoading("createCollectionbutton", "Create");
            if (data.responseJSON) {
                if ("reason" in data.responseJSON) {
                    message = "Failed to add collection due to: " + data.responseJSON.reason;
                } else if ("message" in data.responseJSON) {
                    message = "Failed to add collection due to: " + data.responseJSON.message;
                } else {
                    message = "Failed to add collection.";
                }
            } else if ("statusText" in data) {    
                message = "Failed to add collection due to: " + data.statusText;
            } else {
                message = "Failed to add collection.";
            }
            showMessage("createCollectionMessage", "error", message);
            console.log('Failed to load collection: ' + data);
        }
    });
}


function addManifest() {
    setLoading("add_manifest", "Adding");
    var manifestUri = document.getElementById("manifest_uri").value;
    var collectionURI = document.getElementById("collection_uri").value;
    $.ajax({
        url: manifestUri,
        type: 'GET',
        success: function(manifest) {
            delete manifest.within;
            manifest.within = collectionURI;
            $.ajax({
                url: 'manifests',
                type: 'POST',
                data: JSON.stringify(manifest),
                contentType: "application/json; charset=utf-8",
                dataType: "json",
                success: function(data) {
                    showMessage("addManifestMessages", "info", "Manifest added succesfully to collection.");
                    clearLoading("add_manifest", "Add");

                    $('#addManifest').modal('toggle');
                    hideMessage("addManifestMessages");
                    window.location.href = 'collections.xhtml?collection=' + collectionURI;
                },
                error: function(data) {
                    clearLoading("add_manifest", "Add");
                    if (data.responseJSON) {
                        if ("reason" in data.responseJSON) {
                            message = "Failed to add manifest due to: " + data.responseJSON.reason;
                        } else if ("message" in data.responseJSON) {
                            message = "Failed to add manifest due to: " + data.responseJSON.message;
                        } else {
                            message = "Failed to add manifest. SAS only currently supports IIIF version 2 manifests.";
                        }
                    } else if ("statusText" in data) {
                            message = "Failed to add manifest due to: " + data.statusText;
                    } else {
                        message = "Failed to add manifest. SAS only currently supports IIIF version 2 manifests.";
                    }
                    showMessage("addManifestMessages", "error", message);
                    console.log('Failed to add manifest: ' + data);
                }
            });

        },
        error: function(data) {
            clearLoading("add_manifest", "Add");
            showMessage("addManifestMessages", "error", "Failed to retrieve Manifest. If it's accessible than it could be a CORS issue.");
            console.log('Failed to delete collection: ' + data);
        }
    });
}

function setupContentState(uri, description) {
    var a = document.createElement("a");
    a.href = uri;
    a.title = description;

    var img = document.createElement("img");
    img.src = "https://iiif.io/img/logo-iiif-34x30.png";
    img.draggable = true;
    img.ondragstart = drag;
    img.dataset.link = uri;

    a.appendChild(img);
    a.onclick = copyClipboard;

    return a;
}

function drag(ev) {
    ev.dataTransfer.setData("text/plain", ev.srcElement.dataset.link);
} 

function copyClipboard(event) {
    var data = document.createElement("input");
    data.style = "position: absolute; left: -1000px; top: -1000px";
    document.body.appendChild(data);
    data.value = event.srcElement.dataset.link;
    data.select();
    try {
        document.execCommand("copy");
        event.preventDefault();
        document.body.removeChild(data);
        document.getElementById("copyTitle").innerHTML = "Copied to Clipboard!";
        document.getElementById("copyURI").innerHTML = event.srcElement.dataset.link;
        $('#copy').modal('toggle');
        return true;
    } catch (error) {
        console.log("Failed to copy url due to: " + error);
    }
    document.body.removeChild(data);
    return true;
}
