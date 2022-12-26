ProcessManage = class ProcessManage {
    constructor(options) {
        Object.assign(this, options);
        this.status = "close";
        this.modal = null;
        this.issueChecker = null;
        this.confirm_msg_status = false;
        this.items = {};
        this.command_items = {};
        this.command_container_name = this.table.data.name + "-command_container";
        this.new_items_keys = [];

        this.initialize(options);
    }

    reload() {
        this.get_commands_food();
    }

    check_complain_status(options) {
        this.issueChecker = setInterval(async () => {
            let issues = await frappe.db.get_list("Issue", {
                filters: [
                    ["Issue", "issuer_type", "=", "Customer"],
                    ["Issue", "status", "=", "Open"],
                    // ["Issue", "owner", "=", frappe.session.user],
                    ["Issue", "branch_name", "=", "options.table.data.name"]
                ],
                fields: "*",
                limit: 40
            });

            if(issues.length > 0 && !this.confirm_msg_status) {
                this.confirm_msg_status = true;
                frappe.confirm('There are some complains to you. Do you want to check them?',
                    () => {
                        frappe.set_route('/issue');
                    }
                );
            };
        }, 1000);
    }

    initialize(options) {
        this.title = this.table.room.data.description + " (" + this.table.data.description + ")";
        if (this.modal == null) {
            this.modal = RMHelper.default_full_modal(this.title, () => this.make());
        } else {
            this.show();
        }

        this.check_complain_status(options)
    }

    show() {
        this.modal.show();
    }

    is_open() {
        return this.modal.modal.display;
    }

    close() {
        this.modal.hide();
        this.status = "close";
    }

    make() {
        this.make_dom();
        this.get_commands_food();
    }

    make_dom() {
        this.modal.container.empty().append(this.template());
        this.modal.title_container.empty().append(
            RMHelper.return_main_button(this.title, () => this.modal.hide()).html()
        );
    }

    template() {
        return `
		<div class=" process-manage">
            <div class="food-container-sidebar">
                <a href="/app/table-order" class="sidebar-btn btn-order">Order</a>
                <a href="/app/report" class="sidebar-btn btn-report">Report</a>
                <a href="/app/issue" class="sidebar-btn btn-complain">Complain</a>
            </div>
			<div class="food-container-main" id="${this.command_container_name}"></div>
		</div>`;
    }

    categorize_commands_food(commands = []) {
        let tmp = {}, order_list = [];
        commands.forEach(command => {
            if(order_list.includes(command.order_name)) {
                tmp[command.order_name].status[command.status.toLowerCase()].push(command);
            } else {
                order_list.push(command.order_name);
                tmp[command.order_name] = {
                    order_id: command.order_name,
                    status: {
                        attending: [],
                        sent: [],
                        processing: [],
                        completed: [],
                        delivering: [],
                        delivered: []
                    }
                };
                // tmp[command.order_name].order.push(command);
                tmp[command.order_name].status[command.status.toLowerCase()].push(command);
            }
        });

        this.items = tmp;

        return tmp;
    }

    get_commands_food() {
        RM.working("Load commands food");
        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.table.data.name,
            method: "commands_food",
            args: {},
            always: async (r) => {
                RM.ready();
                const tmp = this.categorize_commands_food(r.message);
                await this.make_food_commands(tmp);
            }
        });
    }

    async make_food_commands(items = {}) {
        const _items = Object.keys(items);
        this.new_items_keys = [];
        const status = ["attending", "sent", "processing", "completed", "delivering", "delivered"];

        if(_items.length > 0) {
            for(let i=0; i<_items.length;i++) {
                for(let j=0; j<status.length;j++) {
                    if(items[_items[i]].status[status[j]].length > 0) {
                        await this.add_item(items[_items[i]].status[status[j]]);
                    }
                }
            }
        }

        this.time_elapsed();
    }

    time_elapsed() {
        setInterval(() => {
            this.in_items(item => {
                item.time_elapsed
            });
        }, 1000);
    }

    in_items(f) {
        Object.keys(this.command_items).forEach(k => {
            f(this.command_items[k]);
        })
    }

    check_items(items) {
        items.forEach((item) => {
            this.check_item(item);
        });
    }

    check_item(item) {
        if (Object.keys(this.items).includes(item.identifier)) {
            const _item = this.items[item.identifier];
            if (this.include_status(item.status)) {
                _item.data = item;
                _item.refresh_html();
            } else {
                _item.remove();
            }
        } else {
            if (this.include_status(item.status) && this.include_item_group(item.item_group)) {
                this.new_items_keys.push(item.identifier);
            }
        }
    }

    debug_items() {
        Object.keys(this.items).filter(x => !this.new_items_keys.includes(x)).forEach((r) => {
            this.items[r].remove();
        });
    }

    remove_item(item) {
        if (this.items[item]) {
            this.items[item].remove();
        }
    }

    async add_item(items) {
        if(items && items.length > 0) {
            this.command_items[items[0].order_name + '_' + items[0].status] = new FoodCommand(items);
            this.command_items[items[0].order_name + '_' + items[0].status].process_manage = this;
            // await this.command_items[items[0].order_name + '_' + items[0].status].init();
            this.command_items[items[0].order_name + '_' + items[0].status].init();
        }
    }

    include_status(status) {
        return this.table.data.status_managed.includes(status);
    }

    include_item_group(item_group) {
        return this.table.data.items_group.includes(item_group);
    }

    container() {
        return $(`#orders-${this.table.data.name}`);
    }

    command_container() {
        return document.getElementById(this.command_container_name);
    }
}