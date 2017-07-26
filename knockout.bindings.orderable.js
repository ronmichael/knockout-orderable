// FROM: https://github.com/ronmichael/knockout-orderable
// forked FROM: https://github.com/rapito/knockout-orderable/tree/multi-sort
// forked FROM: https://github.com/apuchkov/knockout-orderable
ko.bindingHandlers.orderable = {
    getProperty: function (o, s) {
        // copied from http://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-with-string-key
        s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
        s = s.replace(/^\./, '');           // strip a leading dot
        var a = s.split('.');
        while (a.length) {
            var n = a.shift();
            if (n in o) {
                o = ko.utils.unwrapObservable(o[n]);
            } else {
                return;
            }
        }
        return o;
    },

    // Extracts value from a field if its a function or not.
    getVal: function (object, string) {
        object = ko.utils.unwrapObservable(object); // RMZ: always make sure we have unwrapped the object
        var field = ko.bindingHandlers.orderable.getProperty(object, string);
        return ko.utils.unwrapObservable(field);
    },

    compare: function (left, right) {

        // custom for sustrana
        if (left === null || left === '') return 1;
        if (right === null || right === '') return -1;
        ///////////

        if (typeof left === 'string' || typeof right === 'string') {
            return left ? left.localeCompare(right) : 1;
        }
        

        if (left > right)
            return 1;

        return left < right ? -1 : 0;
    },


    //get all sort results of thenBy fields
    sortThenBy: function (left, right, field, thenBy, orderDirection) {
        var sortResults = [];

        if (!thenBy) return sortResults;

        var thenByFields = thenBy.split(','); // extract fields

        for (var i = 0; i < thenByFields.length; i++) {

            var tbField = thenByFields[i].trim();
            var lv = ko.bindingHandlers.orderable.getVal(left, tbField);
            var rv = ko.bindingHandlers.orderable.getVal(right, tbField);
            var sort = 0;

            if (orderDirection == "desc") {
                sort = ko.bindingHandlers.orderable.compare(rv, lv);
            } else {
                sort = ko.bindingHandlers.orderable.compare(lv, rv);
            }

            sortResults.push(sort);
        }

        return sortResults;
    },

    sort: function (viewModel, collection, field, thenBy) {

        var orderDirection = viewModel[collection].orderDirection();

        //make sure we sort only once and not for every binding set on table header
        if (viewModel[collection].orderField() == field) {

            if (viewModel[collection].orderPreSort) viewModel[collection].orderPreSort();

            viewModel[collection].sort(function (left, right) {
                var leftVal = ko.bindingHandlers.orderable.getVal(left, field);
                var rightVal = ko.bindingHandlers.orderable.getVal(right, field);

                // these will hold all fields for the thenBy fields
                // evaluate all thenBy compare first
                var thenByResults = ko.bindingHandlers.orderable.sortThenBy(left, right, field, thenBy, orderDirection);

                var sort = 0;

                if (orderDirection == "desc") {
                    sort = ko.bindingHandlers.orderable.compare(rightVal, leftVal);
                } else {
                    sort = ko.bindingHandlers.orderable.compare(leftVal, rightVal);
                }

                // sort then by fields in same order
                if (thenByResults.length > 0) {
                    for (var i = 0; i < thenByResults.length; i++) {
                        sort = sort || thenByResults[i];
                    }
                }

                return sort;
            });
            if (viewModel[collection].orderPostSort) viewModel[collection].orderPostSort();


        }
    },

    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        //get provided options
        var collection = valueAccessor().collection;
        var field = valueAccessor().field;
        var thenBy = valueAccessor().thenBy;

        if (viewModel[collection].orderPreSort == undefined) viewModel[collection].orderPreSort = valueAccessor().preSort;
        if (viewModel[collection].orderPostSort == undefined) viewModel[collection].orderPostSort = valueAccessor().postSort;


        //add a few observables to ViewModel to track order field, direction, and then by fields
        if (viewModel[collection].orderField == undefined) {
            viewModel[collection].orderField = ko.observable();
        }
        if (viewModel[collection].orderDirection == undefined) {
            viewModel[collection].orderDirection = ko.observable("asc");
        }
        if (viewModel[collection].orderThenByFields == undefined) {
            viewModel[collection].orderThenByFields = ko.observable();
        }

        var remember = $.jStorage.get('knockout.orderable.remember') || {};
        var rememberKey = collection + "_" + ($cvpath || location.pathname).replace(/\//g, '_');
        
        var defaultField = remember[rememberKey + "_orderField"] ? remember[rememberKey + "_orderField"] == valueAccessor().field : valueAccessor().defaultField; 
        var defaultDirection = remember[rememberKey + "_orderField"] ? remember[rememberKey + "_orderDirection"] : valueAccessor().defaultDirection || "asc";
        var defaultThenBy = valueAccessor().defaultThenBy || null;


        if (defaultField) {
            viewModel[collection].orderField(field);
            viewModel[collection].orderDirection(defaultDirection);
            viewModel[collection].orderThenByFields(defaultThenBy);
            ko.bindingHandlers.orderable.sort(viewModel, collection, field, thenBy);
        }

        //set order observables on table header click
        $(element).click(function (e) {
            e.preventDefault();

            //flip sort direction if current sort field is clicked again
            if (viewModel[collection].orderField() == field) {
                if (viewModel[collection].orderDirection() == "asc") {
                    viewModel[collection].orderDirection("desc");
                } else {
                    viewModel[collection].orderDirection("asc");
                }
            }

            viewModel[collection].orderField(field);
            viewModel[collection].orderThenByFields(thenBy);
        });

        viewModel[collection].orderField.subscribe(function (value) {
            ko.bindingHandlers.orderable.sort(viewModel, collection, field, thenBy);
            var remember = $.jStorage.get('knockout.orderable.remember') || {};
            remember[rememberKey + "_orderField"] = value;
            $.jStorage.set('knockout.orderable.remember', remember);

        });

        viewModel[collection].orderDirection.subscribe(function (value) {
            ko.bindingHandlers.orderable.sort(viewModel, collection, field, thenBy);
            var remember = $.jStorage.get('knockout.orderable.remember') || {};
            remember[rememberKey + "_orderDirection"] = value;
            $.jStorage.set('knockout.orderable.remember', remember);
        });

     

    },

    update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        //get provided options
        var collection = valueAccessor().collection;
        var field = valueAccessor().field;
        var isOrderedByThisField = viewModel[collection].orderField() == field;

        //apply css binding programmatically
        ko.bindingHandlers.css.update(
            element,
            function () {
                return {
                    sorted: isOrderedByThisField,
                    asc: isOrderedByThisField && viewModel[collection].orderDirection() == "asc",
                    desc: isOrderedByThisField && viewModel[collection].orderDirection() == "desc"
                };
            },
            allBindingsAccessor,
            viewModel,
            bindingContext
        );
    }
};
