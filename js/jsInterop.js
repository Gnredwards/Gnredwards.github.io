window.TimeMapUtilities = {
    getBoundengRectOffset: function (elementId) {
        const rect = document.getElementById(elementId).getBoundingClientRect();
        return {
            left: rect.left + window.scrollX,
            top: rect.top + window.scrollY
        };
    },
    saveAsFile: function (filename, bytesBase64) {
        var newfilename = prompt("Please enter a file name", filename);
        if(newfilename){
            var link = document.createElement('a');
            link.download = newfilename + ".json";
            link.href = "data:application/octet-stream;base64," + bytesBase64;
            document.body.appendChild(link); // Needed for Firefox
            link.click();
            document.body.removeChild(link);
            DotNet.invokeMethod("MapMyTime", "UpdateText", 0, newfilename);
        }
    },
    openURL: function(){
        return prompt("Enter a link to Json file to dowload", "https://MapMyTime/MapMyTime.json");
    },
    runFileInput: function(element) {
        element.value="";
        element.click();
    },
    alertMessage: function(message){
        alert(message);
    },
    updateURLwithoutReload: function(newURL)
    {
        window.history.pushState("data", "Map My Time", newURL);
    },
    positionIcons: function () {
        var svgDoc = document.getElementById("svg")
        var boundingClient = svgDoc.getBoundingClientRect();
        var pt = svgDoc.createSVGPoint();
        pt.y = boundingClient.top + 4;
        pt.x = boundingClient.right - 24;
        document.getElementById("saveIcon").setAttribute("x", pt.matrixTransform(svgDoc.getScreenCTM().inverse()).x);
        document.getElementById("saveIcon").setAttribute("y", pt.matrixTransform(svgDoc.getScreenCTM().inverse()).y);
    }
};



window.D3TimeMapUtilities = {
    createD3Tree: function (jsonTimeMapData) {

        var root = d3.hierarchy(JSON.parse(jsonTimeMapData));
        const duration = d3.event && d3.event.altKey ? 2500 : 250;

        var diagonal = d3.linkHorizontal()
            .x(function (d) {
                return d.x;
            })
            .y(function (d) {
                return d.y;
            });

        const viewboxx = 700, viewboxy = 700;

        setRootDataXandYCoords(root); //TODO - can we do this better

        var defaultheight;

        const svgMain = d3.create("svg")
            .attr("id", "svg")
            .attr("viewBox", [0, 0, viewboxx, viewboxy])
            .style("font", root.data.fontsizepx + "px sans-serif")
            .style("user-select", "none")
            .on("click", function () {
                var mouseposition = d3.mouse(document.getElementsByTagName("g")[0]);
                d3.event.stopPropagation();
                let parentnode = d3.select(".show");
                var parentnodeid = 0;
                if (!parentnode.empty()) {
                    parentnodeid = parentnode.datum().data.nodeid;
                }
                DotNet.invokeMethodAsync("MapMyTime", "AddNewNodeAsync", mouseposition, parentnodeid, defaultheight)
                    .then(returnednode => {
                        var newnode = d3.hierarchy(JSON.parse(returnednode));
                        var parentdata;
                        var parentnode = d3.select("#node" + newnode.data.parentNodeId);
                        if (parentnode.empty()) { parentdata = root; }
                        else { parentdata = parentnode.datum(); }
                        newnode.x0 = newnode.x = newnode.data.xCoordinate;
                        newnode.y0 = newnode.y = newnode.data.yCoordinate;
                        newnode.depth = newnode.data.nodedepth;
                        newnode.parent = parentdata;
                        if (!parentdata.children) {
                            parentdata.children = [];
                            parentdata.data.children = [];
                        }
                        parentdata.children.push(newnode);
                        parentdata.data.children.push(newnode.data);
                        d3update();
                    });
            });


        svgMain.append("filter")
            .attr("id", "deletefilter")
            .append("feGaussianBlur")
            .attr("in", "SourceGraphic")
            .attr("stdDeviation", "5");

        const svg = svgMain.append("g")
            .attr("fill", "none")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("transform", "translate(" + root.data.xTranslate + "," + root.data.yTranslate + ") scale(" + root.data.scale + ")")
            .on("mouseleave", function () {
                var showing = d3.selectAll(".show");
                if (!showing.empty()) {
                    showing.classed("show", false);
                }
            });

        svgMain.call(d3.zoom()
            .clickDistance(10)
            .on("zoom", function () {
                if (d3.event.target.nodeName !== "PATH") {
                    svg.attr("transform", d3.event.transform);
                }
            })
            .on("end", function () {
                if (d3.event.target.nodeName !== "PATH") {
                    if (!(d3.event.transform.k === 1 &&
                        d3.event.transform.x === 0 &&
                        d3.event.transform.y === 0)) {
                        DotNet.invokeMethod("MapMyTime", "UpdateTranslation", d3.event.transform);
                        root.data.scale = d3.event.transform.k;
                    }
                }
            })
        );
        const proximityRect = svg.append("g")
            .attr("id", "proximityrect");

        const gLink = svg.append("g")
            .attr("id", "linkgroup")
            .attr("class", "glink");

        const gNode = svg.append("g")
            .attr("id", "nodegroup");

        const lumpNodes = svg.append("g")
            .attr("id", "lumpgroup");

        var dragWithCtlKey = false;
        var isdragging = false;
        var flexdivdragging = false;
        var groupdragx;
        var groupdragy;
        nodeDragListener = d3.drag()
            .on("start", function (d) {
                flexdivdragging = true;
                isdragging = false;
                if (d3.event.sourceEvent.ctrlKey || d3.event.sourceEvent.metaKey) {
                    dragWithCtlKey = true;
                    groupdragx = 0;
                    groupdragy = 0;
                    var draggroup = svg.append("g")
                        .attr("id", "draggroup");
                    var linkdraggroup = draggroup.append("g")
                        .attr("id", "linkdraggroup")
                        .attr("class", "glink");
                    d.descendants().forEach((descendant) => {
                        if (d.data.nodeid != descendant.data.nodeid) {
                            draggroup.append(function () {
                                return d3.select("#node" + descendant.data.nodeid).remove().node();
                            })
                            linkdraggroup.append(function () {
                                return d3.select("#link-" + descendant.data.parentNodeId + "-" + descendant.data.nodeid)
                                    .remove().node();
                            })
                            linkdraggroup.append(function () {
                                return d3.select("#linkborder-" + descendant.data.parentNodeId + "-" + descendant.data.nodeid)
                                    .remove().node();
                            });
                        }
                    })
                }
                d3.event.sourceEvent.stopPropagation();
            })
            .on("drag", function (d) {
                if (!flexdivdragging) {
                    return;
                }

                if (!isdragging) {
                    d3.select(".nodecontextmenu").remove();
                    isdragging = true;
                }

                d.x += d3.event.dx;
                d.y += d3.event.dy;

                var node = d3.select("#node" + d.data.nodeid);
                node.attr("transform", "translate(" + d.x + "," + d.y + ")");

                if (dragWithCtlKey) {
                    if (d.data.parentNodeId !== 0) {
                        let nodeLocation = DotNet.invokeMethod("MapMyTime", "UpdateImpactedNode",
                            d.data.nodeid, d.x, d.y, true);
                        d3.select("#link-" + d.data.parentNodeId + "-" + d.data.nodeid).attr("d", () => {
                            return diagonal({ source: nodeLocation.linkendpoints[1], target: nodeLocation.linkendpoints[0] });
                        });
                    }
                    groupdragx += d3.event.dx;
                    groupdragy += d3.event.dy;
                    d3.select("#draggroup")
                        .attr("transform", "translate(" + groupdragx + "," + groupdragy + ")");
                }
                else {
                    let nodeLocations = DotNet.invokeMethod("MapMyTime", "RecalculateMovedNodeLinks",
                        d.data.nodeid, d.x, d.y);

                    nodeLocations.forEach((location) => {
                        if (location.nodeid !== d.data.nodeid) {
                            d3.select("#link-" + d.data.nodeid + "-" + location.nodeid)
                                .attr("d", () => {
                                    return diagonal({ source: location.linkendpoints[0], target: location.linkendpoints[1] });
                                })
                        }
                        else {
                            if (d.data.parentNodeId !== 0) {
                                d3.select("#link-" + d.data.parentNodeId + "-" + location.nodeid)
                                    .attr("d", () => {
                                        return diagonal({ source: location.linkendpoints[0], target: location.linkendpoints[1] });
                                    })
                            }
                        }
                    })
                }
            })
            .on("end", function (d) {
                if (!flexdivdragging) {
                    return;
                }
                flexdivdragging = false;
                if (!isdragging) {
                    return;
                }
                isdragging = false;

                d.data.xCoordinate = d.x;
                d.data.yCoordinate = d.y;
                let nodeLocation = DotNet.invokeMethod("MapMyTime", "UpdateImpactedNode",
                    d.data.nodeid, d.x, d.y, true);

                d.data.midpointconnections = JSON.parse(JSON.stringify(nodeLocation.midpointconnections));
                d.data.parentNodeConnection = nodeLocation.parentnodeconnection;
                d.data.connection = nodeLocation.connection;

                if (d.data.parentNodeId === 0) {
                    d3.select("#linklump" + d.data.nodeid)
                        .attr("transform", () => `translate(${d.x + (d.data.width / 2) - 4}, ${d.y - 8})`);
                }
                else {
                    d3.select("#linkborder-" + d.data.parentNodeId + "-" + d.data.nodeid)
                        .attr("d", () => diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] }));
                }


                if (dragWithCtlKey) {
                    var draggednodes = [];
                    d.descendants().forEach((descendant) => {
                        draggednodes.push(descendant.data.nodeid);
                        if (d.data.nodeid != descendant.data.nodeid) {
                            descendant.x = descendant.data.xCoordinate += groupdragx;
                            descendant.y = descendant.data.yCoordinate += groupdragy;

                            let nodeLocation = DotNet.invokeMethod("MapMyTime", "UpdateImpactedNode",
                                descendant.data.nodeid, descendant.x, descendant.y, true);

                            descendant.data.midpointconnections = JSON.parse(JSON.stringify(nodeLocation.midpointconnections));
                            descendant.data.parentNodeConnection = nodeLocation.parentnodeconnection;
                            descendant.data.connection = nodeLocation.connection;

                            gLink.append(function () {
                                var linkdragged = d3.select("#link-" + descendant.data.parentNodeId + "-" + descendant.data.nodeid);
                                linkdragged.attr("d", diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] }));
                                return linkdragged.remove().node();
                            });
                            gLink.append(function () {
                                var linkdragged = d3.select("#linkborder-" + descendant.data.parentNodeId + "-" + descendant.data.nodeid);
                                linkdragged.attr("d", diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] }));
                                return linkdragged.remove().node();
                            });

                            gNode.append(function () {
                                var nodedragged = d3.select("#node" + descendant.data.nodeid);
                                nodedragged.attr("transform", "translate(" + descendant.x + "," + descendant.y + ")");
                                return nodedragged.remove().node();
                            });
                        }
                        DotNet.invokeMethodAsync("MapMyTime", "UpdateProximityMapAsync", draggednodes).then();
                        d3.select("#proximityrect" + descendant.data.nodeid)
                            .attr("transform", d => `translate(${descendant.x - defaultwidth},${descendant.y - defaultwidth})`);
                    });
                    d3.select("#draggroup").remove();
                    dragWithCtlKey = false;
                }
                else { //Only dragging a single node
                    var childpaths = d3.selectAll("path").filter('[id^="link-' + d.data.nodeid + '-"]');
                    childpaths.attr("d", p => {
                        let nodeLocation = DotNet.invokeMethod("MapMyTime", "UpdateImpactedNode",
                            p.target.data.nodeid, p.target.x, p.target.y, false);
                        p.target.data.parentNodeConnection = nodeLocation.parentnodeconnection;
                        p.target.data.connection = nodeLocation.connection;
                        var returndiagonal = diagonal({ source: nodeLocation.linkendpoints[0], target: nodeLocation.linkendpoints[1] });
                        d3.select("#linkborder-" + p.source.data.nodeid + "-" + p.target.data.nodeid)
                            .attr("d", returndiagonal);
                        return returndiagonal;
                    });
                    DotNet.invokeMethodAsync("MapMyTime", "UpdateProximityMapAsync", [d.data.nodeid]).then();
                    d3.select("#proximityrect" + d.data.nodeid)
                        .attr("transform", d => `translate(${d.x - defaultwidth},${d.y - defaultwidth})`);
                }
                createcontexmenu(d);
            });

        var newparentnodeid = -1;
        linkDragListener = d3.drag()
            .on("start", function (d) {
                const selectedLink = d3.select("#link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                const t = d.target.data.midpointconnections[d.target.data.connection];
                selectedLink.classed("linkdragging", true)
                    .attr("d", d => {
                        const o = { x: d3.event.x, y: d3.event.y };
                        return diagonal({ source: o, target: t });
                    })
                    .attr("pointer-events", "none");
            })
            .on("drag", function (d) {
                const selectedLink = d3.select("#link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                selectedLink.attr("d", p => {
                    const o = { x: d3.event.x, y: d3.event.y };
                    return diagonal({ source: o, target: d.target.data.midpointconnections[d.target.data.connection] });
                });
                var documentmouse = d3.mouse(d3.select("body").node());
                var element = document.elementFromPoint(documentmouse[0], documentmouse[1]);
                if (element) {
                    if (element.id.includes("proximityrect")) {
                        highlightConnectionNode(d3.select(element).datum().data.nodeid, d.target.data.nodeid);
                    }
                }
            })
            .on("end", function (d) {
                const selectedLink = d3.select("#link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                selectedLink
                    .classed("linkdragging", false)
                    .attr("pointer-events", "auto")
                    .attr("d", p => {
                        const o = { x: d3.event.x, y: d3.event.y };
                        return diagonal({ source: o, target: d.target.data.midpointconnections[d.target.data.connection] });
                    });

                var newparentnode = d3.select(".show");

                if (newparentnode.empty()) {
                    newparentnode = d3.select(".nodecontextmenu");
                }

                if (newparentnode.empty()) {
                    newparentnodeid = 0;
                }
                else {
                    newparentnodeid = newparentnode.datum().data.nodeid;
                }

                if (newparentnodeid === d.target.data.nodeid) { newparentnodeid = 0 };
                if (newparentnodeid === d.source.data.nodeid) {
                    selectedLink.attr("d", p => {
                        if (d.source.data.nodeid === 0) {
                            return null;
                        }
                        return diagonal({
                            source: d.source.data.midpointconnections[d.target.data.parentNodeConnection],
                            target: d.target.data.midpointconnections[d.target.data.connection]
                        });
                    });
                    return;
                }
                switchParent(d.target.data.nodeid, d.source.data.nodeid, newparentnodeid);
            });

        var resizenode = d3.drag()
            .on("start", function (d) {
                d3.event.sourceEvent.stopPropagation();
                d.data.autosize = false;
            })

            .on("drag", function (d) {
                d.data.width += d3.event.dx;
                d.data.height += d3.event.dy;

                updateNodeDimensions([{
                    nodeid: d.data.nodeid,
                    height: d.data.height,
                    width: d.data.width,
                    autosize: d.data.autosize
                }]);

                d3.select("#foid" + d.data.nodeid)
                    .attr("width", d.data.width)
                    .attr("height", d.data.height);

                d3.select("#rectid" + d.data.nodeid)
                    .attr("width", d.data.width)
                    .attr("height", d.data.height);
            })

            .on("end", function () {
                reloadRootData();
                d3update();
            });

        var highlightParentNode = function (proximalnodeid) {
            DotNet.invokeMethodAsync("MapMyTime", "GetParentNodeIdFromProximalNode", proximalnodeid, d3.mouse(document.getElementsByTagName("g")[0]))
                .then(function (parentnodeid) {
                    highlightnode(parentnodeid);
                });
        }

        var highlightConnectionNode = function (proximalnodeid, sourcenodeid) {
            DotNet.invokeMethodAsync("MapMyTime", "GetConnectionNodeId", proximalnodeid, d3.mouse(document.getElementsByTagName("g")[0]), sourcenodeid)
                .then(function (parentnodeid) {
                    highlightnode(parentnodeid);
                });
        }

        function highlightnode(nodetohighlight) {
            var showingnodes = d3.selectAll(".show");
            if (showingnodes.size() === 1) {
                if (showingnodes.datum().data.nodeid === nodetohighlight) { return; }
            }
            if (!d3.selectAll(".asyncflag").empty()) {
                return;
            }
            showingnodes.classed("show", false);
            d3.select("#highlightRect" + nodetohighlight)
                .classed("show", true);
        }

        function contextMenu() {
            var height,
                width,
                margin = 0.1, // fraction of width
                items = [],
                inputwidth,
                dimensionscalculated = false;

            function nodemenu(nodedata) {
                d3.select('.node-menu').remove();
                let autosize = nodedata.data.autosize;
                if (!dimensionscalculated) {
                    calculatedimensions(nodedata.data.nodeid, 10);
                }
                var nodestochange = getNodesToChange(nodedata.data.nodeid);

                gNode
                    .append('g').attr('class', 'node-menu')
                    .on("click", function () {
                        d3.event.stopPropagation();
                    })
                    .on("mouseleave", () => {
                        d3.select('.node-menu').remove();
                        d3.selectAll(".nodetobechanged").classed("nodetobechanged", false);
                    })
                    .attr("transform", d =>
                        `translate(${nodedata.x + nodedata.data.width - 20},${nodedata.y})`)
                    .selectAll('tmp')
                    .data(d3.entries(items).filter(function (item) {
                        if (item.value.attributename === "autosize") {
                            return (!autosize);
                        }
                        else { return true;}
                    })
                        , d => d.value.menutext)
                    .join(
                        function (enter) {
                            var menuelements = enter.append('g').attr('class', 'menu-entry');
                            menuelements
                                .append('rect')
                                .attr('y', function (d, i) { return (i * height); })
                                .attr('width', width + inputwidth)
                                .attr('height', height)
                                .attr("data-fillcolour", nodedata.data.fill)
                                .attr("data-nodeid", nodedata.data.nodeid)
                                .classed("menurect", true);

                            menuelements
                                .append('text')
                                .text(d => d.value.menutext)
                                .attr('y', function (d, i) { return (i * height); })
                                .attr('dy', (height - margin / 2) * 0.75)
                                .attr('dx', margin)
                                .classed("menutext", true);

                            var menufo = menuelements.append("foreignObject")
                                .attr("id", d => d.value.attributename)
                                .attr("x", function (d) {
                                    if (d.value.attributename === "deletebutton") {
                                        return;
                                    }
                                    return width;
                                })
                                .attr('y', function (d, i) { return (i * height); })
                                .attr("width", function (d) {
                                    if (d.value.attributename === "deletebutton") {
                                        return width + inputwidth;
                                    }
                                    return inputwidth;
                                })
                                .attr("height", height)
                                .attr("data-menuparent", d => d.value.menuparent)

                            var menupar = menufo.append(menufo.attr("data-menuparent"))
                                .attr("data-menuelement", d => d.value.menuelement)
                                .attr("class", "contextmenudiv")

                            menupar.append(menupar.attr("data-menuelement"))
                                .attr("type", d => d.value.menutype)
                                .classed("menuerange", d => (d.value.menutype === "range"))
                                .classed("menucheckbox", d => (d.value.menutype === "checkbox"))
                                .classed("trashbutton", d => (d.value.attributename === "deletebutton"))
                                .attr("width", function (d) {
                                    if (d.value.menutype === "color") { return inputwidth; }
                                    if (d.value.menutype === "button") { return inputwidth; }
                                    return null;
                                })
                                .text(function (d) {
                                    if (d.value.menutype === "button") { return "Delete"; }
                                    return null;
                                })
                                .attr("value", function (d) {
                                    if (d.value.menutype === "checkbox") { return null; }
                                    if (d.value.menutype === "button") { return "Delete"; }
                                    return Reflect.get(nodedata.data, d.value.attributename);
                                })
                                .property("checked", function (d) {
                                    if (d.value.menutype === "checkbox") {
                                        return Reflect.get(nodedata.data, d.value.attributename);
                                    }
                                    return false;
                                })
                                .attr("min", function (d) {
                                    if (d.value.menutype === "range") {
                                        return d.value.minvalue;
                                    }
                                    return null;
                                })
                                .attr("max", function (d) {
                                    if (d.value.menutype === "range") {
                                        return d.value.maxvalue;
                                    }
                                    return null;
                                })
                                .attr("step", function (d) {
                                    if (d.value.menutype === "range") {
                                        return 1;
                                    }
                                    return null;
                                })
                                .attr("data-nodeid", d => nodedata.data.nodeid)
                                .on("input", function (d) {
                                    d3.event.stopPropagation();
                                    if (d.value.menutype === "checkbox") {
                                        DotNet.invokeMethod("MapMyTime", d.value.dotnetmethod, this.dataset.nodeid, this.checked);
                                        Reflect.set(d3.select("#node" + this.dataset.nodeid).datum().data, d.value.attributename, this.checked);
                                        nodestochange = getNodesToChange(this.dataset.nodeid);
                                    }
                                    else {
                                        invokeDotNetMethod(d.value.dotnetmethod, nodestochange, this.value);
                                        if (d.value.menutype === "color") {
                                            updatenodecolour(nodestochange, this.value);
                                        }
                                        if (d.value.attributename === "fontsizepx") {
                                            updatefontsizes(nodestochange, parseInt(this.value));
                                        }
                                        else {
                                            reloadRootData();
                                            d3update();
                                        }
                                    }
                                })
                                .on("mousedown", function () { d3.event.stopPropagation(); })
                                .on("change", function (d) {
                                    if (d.value.attributename === "fontsizepx") {
                                        updatefontsizes(nodestochange, parseInt(this.value));
                                    }
                                })
                                .on("mouseenter", function (d) {
                                    if (d.value.attributename === "deletebutton") {
                                        setNodesForDeletion(nodestochange, true);
                                    }
                                    else { return null; }
                                })
                                .on("mouseleave", function (d) {
                                    if (d.value.attributename === "deletebutton") {
                                        setNodesForDeletion(nodestochange, false);
                                    }
                                    else { return null; }
                                })
                                .on("mouseup", function (d) {
                                    if (d.value.attributename === "deletebutton") {
                                        deleteNode(this.dataset.nodeid);
                                    }
                                    else { return null; }
                                });
                        })
            }

            nodemenu.items = function (e) {
                if (!arguments.length) return items;
                for (i in arguments[0]) items.push(arguments[0][i]);
                rescale = true;
                return nodemenu;
            }

            function calculatedimensions(nodeid, fontsize) {
                margin = 0.1;
                d3.select("#node" + nodeid).selectAll('temptext')
                    .data(d3.entries(items)).enter()
                    .append('text')
                    .text(function (d) { return d.value.menutext; })
                    .attr('x', -1000)
                    .attr('y', -1000)
                    .attr('class', 'temptext')
                    .style("font-size", fontsize)

                var bbox = d3.selectAll('.temptext').nodes().map(function (x) { return x.getBBox(); });
                width = d3.max(bbox.map(function (x) { return x.width; }));
                margin = margin * width;
                width = width + 2 * margin;
                height = d3.max(bbox.map(function (x) { return (x.height + margin / 2) * 2; }));

                var menufo = d3.select("#node" + nodeid)
                    .append("foreignObject")
                    .attr("width", width * 0.5)
                    .attr("height", height)
                    .attr("class", "tempfo");
                var menupar = menufo.append("xhtml:div")
                    .attr("class", "flexdiv");
                menupar.append("xhtml:input")
                    .attr("type", "color")
                    .attr("value", "#007BFF")
                    .attr("class", "tempinput");

                inputwidth = (d3.select(".tempinput").node().getBoundingClientRect().width / root.data.scale);// + 2 * margin;

                d3.selectAll(".temptext,.tempfo").remove();
                dimensionscalculated = true;
            }

            return nodemenu;
        }
        //End of context menue creation

        var nodemenu;
        getConstants("contextmenuitems").then(function (menuitems) {
            nodemenu = contextMenu().items(menuitems);
        });
        var defaultwidth;

        setConstantsAndBuildMap();

        //return getAllNodeCoordinates(); //Maybe with the voronoi stuff this can go

        async function setConstantsAndBuildMap() {
            defaultwidth = await DotNet.invokeMethodAsync("MapMyTime", "GetConstantAsync", "defaultwidth");
            defaultheight = await DotNet.invokeMethodAsync("MapMyTime", "GetConstantAsync", "defaultheight");

            d3update();

            var element = document.getElementById("d3SVGdiv");
            if (element.childElementCount > 0) {
                element.replaceChild(svgMain.node(), element.childNodes[1]);
            }
            else {
                element.appendChild(svgMain.node());
            }
            createSaveIcon();
            window.TimeMapUtilities.positionIcons();
        }

        async function getConstants(constantname) {
            let result = await DotNet.invokeMethodAsync("MapMyTime", "GetConstantAsync", constantname);
            return result;
        }

        function reloadRootData() {
            root = d3.hierarchy(JSON.parse(DotNet.invokeMethod("MapMyTime", "GetTimeMapJson")));
            setRootDataXandYCoords(root);
        }
        async function reloadRootDataAsync() {
            let jsonmap = await DotNet.invokeMethodAsync("MapMyTime", "GetJsonDataAsync");
            root = await d3.hierarchy(JSON.parse(jsonmap));
            await setRootDataXandYCoords(root);
        }
        async function getNodesToChange(parentNodeId) {
            return await DotNet.invokeMethodAsync("MapMyTime", "ReturnNodesToChangeAsync", parentNodeId);
        }
        function updateNodesDimensions(nodes) {
            let nodedimensions = [];
            nodes.forEach((node) => {
                let nodedimension = { nodeid: node.nodeid, height: node.height, width: node.width, autosize: node.autosize };
                nodedimensions.push(nodedimension);
            });
            updateNodeDimensions(nodedimensions);
        }
        async function updateNodeDimensions(nodedimensions) {
            let nodelocationdetails = await DotNet.invokeMethodAsync("MapMyTime", "UpdateNodeDimensionsAsync", nodedimensions);
            nodelocationdetails.forEach((location) => {
                var nodedatum = d3.select("#node" + location.nodeid).datum().data;
                nodedatum.midpointconnections = location.midpointconnections;
                nodedatum.parentNodeConnection = location.parentnodeconnection;
                nodedatum.connection = location.connection;
            });
            updateLinks();
        }

        function setRootDataXandYCoords(d3hierarchynode) {
            d3hierarchynode.descendants().forEach((d, i) => {
                if (d.data.nodeid === 0 && root.data.children.length === 0) {
                    d.x0 = d.x = 350;
                    d.y0 = d.y = 255;
                }
                else {
                    d.x0 = d.x = d.data.xCoordinate;
                    d.y0 = d.y = d.data.yCoordinate;
                    d.depth = d.data.nodedepth;
                    //d._children = d.children;
                }
            });
        };
        function createSaveIcon() {
            svgMain.append("image")
                .attr("id", "saveIcon")
                .attr("width", "20px")
                .attr("height", "20px")
                .attr("cursor", "pointer")
                .attr("xlink:href", "./css/open-iconic/icons/data-transfer-download.svg")
                .attr("alt", "download")
                .on("click", function () {
                    DotNet.invokeMethod("MapMyTime", "DownloadMap");
                    d3.event.stopPropagation();
                });
        }
        function createcontexmenu(nodedata) {
            var menunode = d3.select("#node" + nodedata.data.nodeid).append("g")
                .attr('class', 'nodecontextmenu')
                .attr("id", "contextmenu" + nodedata.data.nodeid)

            menunode.append("rect")
                .attr("transform", d => `translate(${0},${-20})`)
                .attr("width", d => nodedata.data.width)
                .attr("height", 20)
                .attr("opacity", 0)
                .on("click", function () {
                    d3.event.stopPropagation();
                });

            menunode.append("path")
                .attr("id", "nodeburger")
                .attr("transform", d => `translate(${nodedata.data.width - 20},${-20})`)
                .attr("fill", "black")
                .attr("stroke-width", "0.1")
                .attr("d", "M 3.12,8.33 H 16.55 c 0.62,0 1.12,-0.52 1.12,-1.17 C 17.67,6.52 17.17,6 16.55,6 H 3.12 C 2.50,6 2,6.52 2,7.17 c 0,0.64 0.5,1.17 1.12,1.17 z M 16.55,10.67 H 3.12 C 2.5,10.67 2,11.19 2,11.83 2,12.48 2.5,13 3.12,13 H 16.55 c 0.62,0 1.12,-0.52 1.12,-1.17 0,-0.64 -0.5,-1.17 -1.12,-1.17 z m 0,4.67 H 3.12 C 2.5,15.33 2,15.856 2,16.5 c 0,0.64 0.5,1.17 1.12,1.17 H 16.55 c 0.62,0 1.12,-0.52 1.12,-1.17 0,-0.64 -0.5,-1.17 -1.12,-1.17 z")
                .on("mouseenter", function (d) {
                    if (d3.select(".node-menu").empty()) {
                        nodemenu(nodedata);
                    }
                    d3.event.stopPropagation();
                })
                .on("click", function () {
                    d3.event.stopPropagation();
                });
        }

        function updatenodecolour(nodesarray, colour) {
            nodesarray.then(function (nodes) {
                nodes.forEach((nodeid) => {
                    d3.select("#node" + nodeid)
                        .attr("fill", colour)
                        .datum().data.fill = colour;
                });
            });
        }

        function updatefontsizes(nodesarray, fontsize) {
            nodesarray.then(function (nodes) {
                nodes.forEach((nodeid) => {
                    var node = d3.select("#node" + nodeid);
                    node.datum().data.fontsizepx = fontsize;
                });
                d3update();
            });
        }

        function switchParent(childid, oldparentid, newparentid) {
            let returnednode = DotNet.invokeMethod("MapMyTime", "SwitchParent", [childid,
                oldparentid, newparentid]);
            let updatednode = d3.hierarchy(JSON.parse(returnednode));
            if (updatednode.data.parentNodeId === newparentid) {
                replaceChild(childid, oldparentid, newparentid, updatednode);
            }
            else {
                d3update();
            }
        }

        function removeNode(nodeid, parentnodeid) {
            var parentdata;
            if (parentnodeid === 0) {
                parentdata = root;
            }
            else {
                parentdata = d3.select("#node" + parentnodeid).datum();
            }

            parentdata.children.splice(parentdata.children.findIndex(x => x.data.nodeid === parseInt(nodeid)), 1);
            parentdata.data.children.splice(parentdata.data.children.findIndex(x => x.nodeid === parseInt(nodeid)), 1);
        }

        function addNewNode(newnode, parentnodeid) {
            var newparentdata;
            if (parentnodeid === 0) {
                newparentdata = root;
            }
            else {
                newparentdata = d3.select("#node" + parentnodeid).datum();
            }

            newnode.parent = newparentdata;

            if (!newparentdata.children) {
                newparentdata.children = [];
            }
            newparentdata.children.push(newnode);
            newparentdata.data.children.push(newnode.data);
        }

        function replaceChild(childid, oldparentid, newparentid, updatednode) {
            setRootDataXandYCoords(updatednode);

            removeNode(childid, oldparentid);
            addNewNode(updatednode, newparentid);

            d3update();
        }

        async function invokeDotNetMethod(method, nodestochange, value) {
            let nodelist = await nodestochange;
            await DotNet.invokeMethodAsync("MapMyTime", method, nodelist, value);
        }

        function setNodesForDeletion(nodelist, forDeletion) {
            nodelist.then(function (nodes) {
                nodes
                    .forEach((nodeitem) => {
                        d3.select("#node" + nodeitem).classed("deleting", forDeletion);
                    });
            });
        }
        function deleteNode(nodeid) {
            let parentnodeid = d3.select("#node" + nodeid).datum().data.parentNodeId;
            let notdeletednodes = DotNet.invokeMethod("MapMyTime", "DeleteNode", nodeid);
            removeNode(nodeid, parentnodeid);
            if (notdeletednodes.length > 0) {
                notdeletednodes.forEach((movednode) => {
                    let newnode = d3.hierarchy(JSON.parse(movednode));
                    setRootDataXandYCoords(newnode);
                    addNewNode(newnode, parentnodeid);
                })
            }
            d3update();
        }

        function d3update() {

            //const nodes = root.descendants().reverse(); //Test to see if this does anything for us
            const nodes = root.descendants();

            const transition = svg.transition()
                .duration(duration);
            // Update the nodes…
            var nodeswithchangedheight = [];
            gNode.selectAll(".standardNode")
                .data(nodes.filter(d => d.depth), d => d.data.nodeid)
                .join(
                    function (enter) {
                        var nodeEnter = enter.append("g")
                            .call(nodeDragListener)
                            .attr("transform", d => `translate(${d.x},${d.y})`)
                            .attr("fill-opacity", 1)
                            .attr("stroke-opacity", 1)
                            .attr("id", d => "node" + d.data.nodeid)
                            .attr("fill", d => d.data.fill)
                            .attr("cursor", "pointer")
                            .classed("standardNode", true)
                            .on("mouseenter", function (d) {
                                if (d3.select("#contextmenu" + d.data.nodeid).empty() && (!isdragging)) {
                                    d3.selectAll(".nodecontextmenu").remove();
                                    createcontexmenu(d);
                                }
                            })
                            .on("mouseleave", function (d) {
                                d3.selectAll(".nodecontextmenu").remove();
                            });

                        var noderect = nodeEnter.append("rect")
                            .attr("id", d => "rectid" + d.data.nodeid)
                            .attr("class", "noderect")
                            .attr("width", d => d.data.width)
                            .attr("height", d => d.data.height)
                            .attr("rx", 2)
                            .attr("ry", 2)
                            .attr("stroke", "black");

                        var fo = nodeEnter.append("foreignObject")
                            .attr("id", d => "foid" + d.data.nodeid)
                            .attr("class", "nodefo")
                            .attr("width", d => d.data.width)
                            .attr("height", d => d.data.height);
                        //Stack overflow 2388164
                        var xdiv = fo.append("xhtml:div")
                            .attr("id", d => "divid" + d.data.nodeid)
                            .attr("tabindex", d => d.data.nodeid)
                            .attr("contenteditable", "true")
                            .attr("class", "flexdiv")
                            .style("font", d => d.data.fontsizepx + "px sans-serif")
                            .text(d => d.data.name)
                            .on("click", function (d) {
                                var p = document.getElementById("divid" + d.data.nodeid),
                                    s = window.getSelection(),
                                    r = document.createRange();
                                r.setStart(p, 0);
                                r.setEnd(p, 1);
                                s.removeAllRanges();
                                s.addRange(r);
                                d3.event.stopPropagation();
                            })
                            .on("blur", function (d) {
                                if (d.data.name !== this.innerText) {
                                    d.data.name = this.innerText;
                                    DotNet.invokeMethod("MapMyTime", "UpdateText", d.data.nodeid, this.innerText);
                                }
                            })
                            .on("keyup", function (d) {
                                var rect = d3.select("#" + "rectid" + d.data.nodeid)
                                if (d.data.autosize) {
                                    if (parseInt(rect.attr("height"), 10) !== this.scrollHeight) {
                                        d.data.height = this.scrollHeight;
                                        updateNodeDimensions([{
                                            nodeid: d.data.nodeid,
                                            height: d.data.height,
                                            width: d.data.width,
                                            autosize: d.data.autosize
                                        }]);

                                        rect.attr("height", d.data.height);
                                        d3.select("#foid" + d.data.nodeid)
                                            .attr("height", d.data.height);
                                        d3.select("#highlightRect" + d.data.nodeid)
                                            .attr("height", d.data.height + 6);
                                        d3.select("#resizehandle" + d.data.nodeid)
                                            .attr("cy", d.data.height);
                                    };
                                };
                            })
                            .on("paste", function (d) {
                                if (d.data.autosize) {
                                    var divelement = this;
                                    setTimeout(function () { divelement.dispatchEvent(new Event("keyup")) });
                                }
                            });

                        nodeEnter.append("circle")
                            .attr("id", d => "resizehandle" + d.data.nodeid)
                            .attr("cx", d => d.data.width)
                            .attr("cy", d => d.data.height)
                            .attr("class", "resizehandle")
                            .attr("r", 7)
                            .attr("fill", d => d.data.fill)
                            .call(resizenode);

                        nodeEnter.append("rect")
                            .attr('class', 'highlightRect')
                            .attr("id", d => "highlightRect" + d.data.nodeid)
                            .attr("transform", "translate(-3,-3)")
                            .attr("width", d => d.data.width + 6)
                            .attr("height", function (d) {
                                if (d.data.autosize) {
                                    if (d3.select("#divid" + d.data.nodeid).node()) {
                                        if (d.data.height !== d3.select("#divid" + d.data.nodeid).node().scrollHeight) {
                                            d.data.height = d3.select("#divid" + d.data.nodeid).node().scrollHeight;
                                            nodeswithchangedheight.push(d.data);
                                            defaultheight = d.data.height;
                                            d3.select("#rectid" + d.data.nodeid).attr("height", d.data.height);
                                            d3.select("#resizehandle" + d.data.nodeid).attr("cy", d.data.height);
                                            d3.select("#foid" + d.data.nodeid).attr("height", d.data.height);
                                        }
                                    }
                                }
                                return d.data.height + 6;
                            })
                            .attr("rx", 2)
                            .attr("ry", 2)
                            .attr("opacity", 0.2) // change this to zero to hide the target area
                            .style("fill", "red")
                            .attr('pointer-events', 'none');

                        return nodeEnter;
                    },

                    function (update) {
                        update
                            .attr("transform", d => `translate(${d.x},${d.y})`)
                            .attr("fill", d => d.data.fill)
                            .attr("class", d => d.data.cssClass);

                        update.select(".flexdiv")
                            .style("font", d => d.data.fontsizepx + "px sans-serif");

                        update.select(".noderect")
                            .attr("height", function (d) {
                                if (d.data.autosize) {
                                    if (d.data.height !== d3.select("#divid" + d.data.nodeid).node().scrollHeight) {
                                        d.data.height = d3.select("#divid" + d.data.nodeid).node().scrollHeight;
                                        nodeswithchangedheight.push(d.data);
                                    }
                                }
                                return d.data.height;
                            })
                            .attr("width", d => d.data.width);

                        update.select(".nodefo")
                            .attr("height", d => d.data.height)
                            .attr("width", d => d.data.width);

                        update.select(".resizehandle")
                            .attr("cx", d => d.data.width)
                            .attr("cy", d => d.data.height)

                        update.select(".highlightRect")
                            .attr("height", d => d.data.height + 6)
                            .attr("width", d => d.data.width + 6);

                        update.select(".linklump")
                            .attr("cx", d => d.data.width / 2)
                    },

                    exit => exit
                        .call(exit => exit.transition(transition).remove()
                            .attr("transform", d => `translate(${viewboxx - 24},${4})`)
                            .attr("fill-opacity", 0)
                            .attr("stroke-opacity", 0))
                ); //This is the end of the join

            // Update the links…
            if (nodeswithchangedheight.length > 0) {
                updateNodesDimensions(nodeswithchangedheight);
            }
            updateLinks();
            updateProximityRects(nodes);
        };

        function updateLinkLumps(links) {
            lumpNodes.selectAll(".linklump")
                .data(links.filter(d => d.target.depth === 1), d => d.target.data.nodeid)
                .join(
                    function (enter) {
                        enter.append("rect")
                            .attr("transform", d => `translate(${d.target.x + (d.target.data.width / 2) - 4},${d.target.y - 8})`)
                            .attr("id", d => "linklump" + d.target.data.nodeid)
                            .attr("width", 8)
                            .attr("height", 8)
                            .attr("class", "linklump")
                            .attr("fill", d => d.target.data.fill)
                            .call(linkDragListener);
                    },
                    function (update) {
                        update
                            .attr("transform", d => `translate(${d.target.x + (d.target.data.width / 2) + -4},${d.target.y - 8})`);
                    },
                    function (exit) {
                        exit.remove();
                    }
                );
        }

        function updateLinks() {
            const links = root.links();
            gLink.selectAll("path")
                .data(links, d => d.target.id)
                .join(
                    function (enter) {
                        enter.append("path")
                            .call(linkDragListener)
                            .classed("link", true)
                            .attr("id", d => {
                                return ("link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                            })
                            .attr("d", d => {
                                if (d.source.data.nodeid === 0) {
                                    return null;
                                }
                                return diagonal({
                                    source: d.source.data.midpointconnections[d.target.data.parentNodeConnection],
                                    target: d.target.data.midpointconnections[d.target.data.connection]
                                });
                            });
                        enter.append("path")
                            .call(linkDragListener)
                            .classed("linkborder", true)
                            .attr("id", d => {
                                return ("linkborder-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                            })
                            .attr("d", d => {
                                if (d.source.data.nodeid === 0) {
                                    return null;
                                }
                                return diagonal({
                                    source: d.source.data.midpointconnections[d.target.data.parentNodeConnection],
                                    target: d.target.data.midpointconnections[d.target.data.connection]
                                });
                            })
                    },
                    function (update) {
                        update
                            .attr("id", d => {
                                return ("link-" + d.source.data.nodeid + "-" + d.target.data.nodeid);
                            })
                            .attr("d", d => {
                                if (d.source.data.nodeid === 0) {
                                    return null;
                                }
                                return diagonal({
                                    source: d.source.data.midpointconnections[d.target.data.parentNodeConnection],
                                    target: d.target.data.midpointconnections[d.target.data.connection]
                                });
                            });
                    },
                    exit => exit
                        .call(exit => exit
                            .attr("d", d => {
                                const o = { x: d.source.x, y: d.source.y };
                                return diagonal({ source: o, target: o });
                            })
                            .remove())
                );
            updateLinkLumps(links);
        };

        function updateProximityRects(nodes) {
            proximityRect.selectAll(".proximityRect")
                .data(nodes.filter(d => d.depth), d => d.data.nodeid)
                .join(
                    function (enter) {
                        enter.append("rect")
                            .classed("proximityRect", true)
                            .attr("id", d => "proximityrect" + d.data.nodeid)
                            .attr("transform", d => `translate(${d.x - defaultwidth},${d.y - defaultwidth})`)
                            .attr("width", d => d.data.width + (defaultwidth * 2))
                            .attr("height", d => d.data.height + (defaultwidth * 2))
                            .attr("opacity", 0) // change this to zero to hide the target area
                            .style("fill", "grey")
                            .on("mousemove", function (d) {
                                highlightParentNode(d.data.nodeid);
                            })
                            .on("mouseout", function () {
                                if (!d3.event.relatedTarget) {
                                    d3.selectAll(".show").classed("asyncflag", true);
                                    d3.selectAll(".highlightRect").classed("show", false);
                                }
                                else {
                                    if (!d3.select(d3.event.relatedTarget).classed("proximityRect")) {
                                        d3.selectAll(".show").classed("asyncflag", true);
                                        d3.selectAll(".highlightRect").classed("show", false);
                                    }
                                }
                            })
                            .on("mouseenter", function () {
                                d3.select('.node-menu').remove();
                                d3.selectAll(".asyncflag").classed("asyncflag", false);
                            });
                    },
                    function (update) {
                        update
                            .attr("transform", d => `translate(${d.x - defaultwidth},${d.y - defaultwidth})`)
                            .attr("width", d => d.data.width + (defaultwidth * 2))
                            .attr("height", d => d.data.height + (defaultwidth * 2));
                    },
                    function (exit) {
                        exit.remove();
                    })
        }
    }
};
window.addEventListener("resize", window.TimeMapUtilities.positionIcons);

