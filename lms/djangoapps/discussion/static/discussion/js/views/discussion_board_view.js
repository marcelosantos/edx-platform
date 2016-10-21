/* globals Discussion */
(function(define) {
    'use strict';

    define([
        'underscore',
        'backbone',
        'edx-ui-toolkit/js/utils/html-utils',
        'edx-ui-toolkit/js/utils/constants',
        'common/js/discussion/utils',
        'text!discussion/templates/topic-thread-list.underscore',
        'text!discussion/templates/discussion-home.underscore'
    ],
    function(_, Backbone, HtmlUtils, Constants, DiscussionUtil, threadListTemplate, discussionHomeTemplate) {
        var DiscussionBoardView = Backbone.View.extend({
            events: {
                'click .forum-nav-browse-title': 'selectTopicHandler',
                'keypress .forum-nav-browse-filter-input': function(event) {
                    return DiscussionUtil.ignoreEnterKey(event);
                },
                'keyup .forum-nav-browse-filter-input': 'filterTopics',
                'keydown .forum-nav-browse-filter-input': 'keyboardBinding',
                'click .forum-nav-browse-menu-wrapper': 'ignoreClick'
            },
            initialize: function(options) {
                this.sidebar_padding = 10;
                this.current_search = '';
                this.mode = 'all';
                this.filterInputReset();
                this.selectedTopic = $('.forum-nav-browse-menu-item:visible .forum-nav-browse-title.is-focused');
                this.displayedCollection = new Discussion(this.collection.models, {
                    pages: this.collection.pages
                });

                this.threadListView = options.threadListView;
                this.listenTo(this.model, 'change', this.render);
                this.render();
            },

            render: function() {
                HtmlUtils.setHtml(this.$('.forum-nav-thread-list'), HtmlUtils.template(threadListTemplate)({
                    threads: this.displayedCollection.models
                }));
                $(window).bind('load scroll resize', this.updateSidebar);
                this.showBrowseMenu(true);
                return this;
            },

            isBrowseMenuVisible: function() {
                return this.$('.forum-nav-browse-menu-wrapper').is(':visible');
            },

            showBrowseMenu: function(initialLoad) {
                if (!this.isBrowseMenuVisible()) {
                    this.$('.forum-nav-browse-menu-wrapper').show();
                    this.$('.forum-nav-thread-list-wrapper').hide();
                    if (!initialLoad) {
                        $('.forum-nav-browse-filter-input').focus();
                        this.filterInputReset();
                    }
                    this.updateSidebar();
                }
            },

            hideBrowseMenu: function() {
                var selectedTopicList = this.$('.forum-nav-browse-title.is-focused');
                if (this.isBrowseMenuVisible()) {
                    selectedTopicList.removeClass('is-focused');
                    this.$('.forum-nav-browse-menu-wrapper').hide();
                    this.$('.forum-nav-thread-list-wrapper').show();
                    if (this.selectedTopicId !== 'undefined') {
                        this.$('.forum-nav-browse-filter-input').attr('aria-activedescendant', this.selectedTopicId);
                    }
                    this.updateSidebar();
                }
            },

            toggleBrowseMenu: function(event) {
                var inputText = this.$('.forum-nav-browse-filter-input').val();
                event.preventDefault();
                event.stopPropagation();
                if (this.isBrowseMenuVisible()) {
                    this.hideBrowseMenu();
                } else {
                    if (inputText !== '') {
                        this.filterTopics(inputText);
                    }
                    this.showBrowseMenu();
                }
            },

            updateSidebar: function() {
                var amount, browseFilterHeight, discussionBottomOffset, discussionsBodyBottom,
                    discussionsBodyTop, headerHeight, refineBarHeight, scrollTop, sidebarHeight, topOffset,
                    windowHeight, $discussionBody, $sidebar;
                scrollTop = $(window).scrollTop();
                windowHeight = $(window).height();
                $discussionBody = this.$('.discussion-column');
                discussionsBodyTop = $discussionBody[0] ? $discussionBody.offset().top : undefined;
                discussionsBodyBottom = discussionsBodyTop + $discussionBody.outerHeight();
                $sidebar = this.$('.forum-nav');
                if (scrollTop > discussionsBodyTop - this.sidebar_padding) {
                    $sidebar.css('top', scrollTop - discussionsBodyTop + this.sidebar_padding);
                } else {
                    $sidebar.css('top', '0');
                }
                sidebarHeight = windowHeight - Math.max(discussionsBodyTop - scrollTop, this.sidebar_padding);
                topOffset = scrollTop + windowHeight;
                discussionBottomOffset = discussionsBodyBottom + this.sidebar_padding;
                amount = Math.max(topOffset - discussionBottomOffset, 0);
                sidebarHeight = sidebarHeight - this.sidebar_padding - amount;
                sidebarHeight = Math.min(sidebarHeight + 1, $discussionBody.outerHeight());
                $sidebar.css('height', sidebarHeight);
                headerHeight = this.$('.forum-nav-header').outerHeight();
                refineBarHeight = this.$('.forum-nav-refine-bar').outerHeight();
                browseFilterHeight = this.$('.forum-nav-browse-filter').outerHeight();
                this.$('.forum-nav-thread-list')
                    .css('height', (sidebarHeight - headerHeight - refineBarHeight - 2) + 'px');
                this.$('.forum-nav-browse-menu')
                    .css('height', (sidebarHeight - headerHeight - browseFilterHeight - 2) + 'px');
            },

            // TODO: move this to the router?
            goHome: function() {
                var url = DiscussionUtil.urlFor('notifications_status', window.user.get('id'));
                HtmlUtils.append(this.$('.forum-content').empty(), HtmlUtils.template(discussionHomeTemplate)({}));
                this.$('.forum-nav-thread-list a').removeClass('is-active').find('.sr')
                    .remove();
                this.$('input.email-setting').bind('click', this.updateEmailNotifications);
                DiscussionUtil.safeAjax({
                    url: url,
                    type: 'GET',
                    success: function(response) {
                        $('input.email-setting').prop('checked', response.status);
                    }
                });
            },

            filterInputReset: function() {
                this.filterEnabled = true;
                this.selectedTopicIndex = -1;
                this.selectedTopicId = null;
            },

            selectOption: function(element) {
                var activeDescendantId, activeDescendantText;
                if (this.selectedTopic.length > 0) {
                    this.selectedTopic.removeClass('is-focused');
                }
                if (element) {
                    element.addClass('is-focused');
                    activeDescendantId = element.parent().attr('id');
                    activeDescendantText = element.text();
                    this.selectedTopic = element;
                    this.selectedTopicId = activeDescendantId;
                    this.$('.forum-nav-browse-filter-input')
                        .attr('aria-activedescendant', activeDescendantId)
                        .val(activeDescendantText);
                }
            },

            keyboardBinding: function(event) {
                var key = event.which,
                    $inputText = $('.forum-nav-browse-filter-input'),
                    $filteredMenuItems = $('.forum-nav-browse-menu-item:visible'),
                    filteredMenuItemsLen = $filteredMenuItems.length,
                    $curOption = $filteredMenuItems.eq(0).find('.forum-nav-browse-title').eq(0),
                    $activeOption, $prev, $next;

                switch (key) {
                case Constants.keyCodes.enter:
                    $activeOption = $filteredMenuItems.find('.forum-nav-browse-title.is-focused');
                    if ($inputText.val() !== '') {
                        $activeOption.trigger('click');
                        this.filterInputReset();
                    }
                    break;

                case Constants.keyCodes.esc:
                    this.toggleBrowseMenu(event);
                    this.$('.forum-nav-browse-filter-input').val('');
                    this.filterInputReset();
                    $('.all-topics').trigger('click');
                    break;

                case Constants.keyCodes.up:
                    if (this.selectedTopicIndex > 0) {
                        this.selectedTopicIndex -= 1;
                        if (this.isBrowseMenuVisible()) {
                            $prev = $('.forum-nav-browse-menu-item:visible')
                            .eq(this.selectedTopicIndex).find('.forum-nav-browse-title')
                            .eq(0);
                            this.filterEnabled = false;
                            $curOption.removeClass('is-focused');
                            $prev.addClass('is-focused');
                        }
                        this.selectOption($prev);
                    }
                    break;

                case Constants.keyCodes.down:
                    if (this.selectedTopicIndex < filteredMenuItemsLen - 1) {
                        this.selectedTopicIndex += 1;
                        if (this.isBrowseMenuVisible()) {
                            $next = $('.forum-nav-browse-menu-item:visible')
                                .eq(this.selectedTopicIndex).find('.forum-nav-browse-title')
                                .eq(0);
                            this.filterEnabled = false;
                            $curOption.removeClass('is-focused');
                            $next.addClass('is-focused');
                        }
                        this.selectOption($next);
                    }
                    break;

                default:
                    break;
                }
                return true;
            },

            filterTopics: function() {
                var items, query, filteredItems,
                    self = this;
                query = this.$('.forum-nav-browse-filter-input').val();
                items = this.$('.forum-nav-browse-menu-item');
                if (query.length === 0) {
                    items.find('.forum-nav-browse-title.is-focused').removeClass('is-focused');
                    return items.show();
                } else {
                    if (this.filterEnabled) {
                        items.hide();
                        filteredItems = items.each(function(i, item) {
                            var path, pathText,
                                $item = $(item);
                            if (!$item.is(':visible')) {
                                pathText = self.getPathText($item).toLowerCase();
                                if (query.split(' ').every(function(term) {
                                    return pathText.search(term.toLowerCase()) !== -1;
                                })) {
                                    path = $item.parents('.forum-nav-browse-menu-item').andSelf();
                                    return path.add($item.find('.forum-nav-browse-menu-item')).show();
                                }
                            }
                            return filteredItems;
                        });
                    }
                    return filteredItems;
                }
            },

            getPathText: function(item) {
                var path, pathTitles;
                path = item.parents('.forum-nav-browse-menu-item').andSelf();
                pathTitles = path.children('.forum-nav-browse-title').map(function(i, elem) {
                    return $(elem).text();
                }).get();
                return pathTitles.join(' / ');
            },

            selectTopicHandler: function(event) {
                event.preventDefault();
                return this.selectTopic($(event.target));
            },

            selectTopic: function($target) {
                var allItems, discussionIds, $item;
                this.hideBrowseMenu();
                $item = $target.closest('.forum-nav-browse-menu-item');

                this.trigger('topic:selected', this.getBreadcrumbText($item));

                if ($item.hasClass('forum-nav-browse-menu-all')) {
                    this.discussionIds = '';
                    this.$('.forum-nav-filter-cohort').show();
                    return this.retrieveAllThreads();
                } else if ($item.hasClass('forum-nav-browse-menu-following')) {
                    this.retrieveFollowed();
                    return this.$('.forum-nav-filter-cohort').hide();
                } else {
                    allItems = $item.find('.forum-nav-browse-menu-item').andSelf();
                    discussionIds = allItems.filter('[data-discussion-id]').map(function(i, elem) {
                        return $(elem).data('discussion-id');
                    }).get();
                    this.retrieveDiscussions(discussionIds);
                    return this.$('.forum-nav-filter-cohort').toggle($item.data('cohorted') === true);
                }
            },

            retrieveAllThreads: function() {
                this.mode = 'all';
                return this.retrieveFirstPage();
            },

            retrieveFollowed: function() {
                this.mode = 'followed';
                return this.retrieveFirstPage();
            },

            retrieveDiscussions: function(discussionIds) {
                this.discussionIds = discussionIds.join(',');
                this.mode = 'commentables';
                return this.retrieveFirstPage();
            },

            retrieveFirstPage: function(event) {
                this.collection.current_page = 0;
                this.collection.reset();
                return this.loadMorePages(event);
            },

            loadMorePages: function(event) {
                var error, lastThread, loadMoreElem, loadingElem, options, ref,
                    self = this;
                if (event) {
                    event.preventDefault();
                }
                loadMoreElem = this.$('.forum-nav-load-more');
                loadMoreElem.empty();
                edx.HtmlUtils.append(loadMoreElem, this.getLoadingContent(gettext('Loading more threads')));
                loadingElem = loadMoreElem.find('.forum-nav-loading');
                DiscussionUtil.makeFocusTrap(loadingElem);
                loadingElem.focus();
                options = {
                    filter: this.filter
                };
                switch (this.mode) {
                case 'search':
                    options.search_text = this.current_search;
                    if (this.group_id) {
                        options.group_id = this.group_id;
                    }
                    break;
                case 'followed':
                    options.user_id = window.user.id;
                    break;
                case 'commentables':
                    options.commentable_ids = this.discussionIds;
                    if (this.group_id) {
                        options.group_id = this.group_id;
                    }
                    break;
                case 'all':
                    if (this.group_id) {
                        options.group_id = this.group_id;
                    }
                    break;
                default:
                }

                ref = this.collection.last();
                lastThread = ref ? ref.get('id') : undefined;
                if (lastThread) {
                    this.once('threads:rendered', function() {
                        var classSelector =
                            ".forum-nav-thread[data-id='" + lastThread + "'] + .forum-nav-thread " +
                            '.forum-nav-thread-link';
                        return $(classSelector).focus();
                    });
                } else {
                    this.once('threads:rendered', function() {
                        var ref1 = $('.forum-nav-thread-link').first();
                        return ref1 ? ref1.focus() : undefined;
                    });
                }
                error = function() {
                    self.renderThreads();
                    DiscussionUtil.discussionAlert(
                        gettext('Sorry'), gettext('We had some trouble loading more threads. Please try again.')
                    );
                };
                return this.collection.retrieveAnotherPage(this.mode, options, {
                    sort_key: this.$('.forum-nav-sort-control').val()
                }, error);
            },

            getLoadingContent: function(srText) {
                return edx.HtmlUtils.template($('#nav-loading-template').html())({srText: srText});
            },

            getBreadcrumbText: function($item) {
                var $parentSubMenus = $item.parents('.forum-nav-browse-submenu'),
                    crumbs = [],
                    subTopic = $('.forum-nav-browse-title', $item)
                        .first()
                        .text()
                        .trim();

                $parentSubMenus.each(function(i, el) {
                    crumbs.push($(el).siblings('.forum-nav-browse-title')
                        .first()
                        .text()
                        .trim()
                    );
                });

                if (subTopic !== 'All Discussions') {
                    crumbs.push(subTopic);
                }

                return crumbs;
            }

        });

        return DiscussionBoardView;
    });
}).call(this, define || RequireJS.define);
