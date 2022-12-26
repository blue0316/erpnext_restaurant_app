class FoodCommand {
    constructor(options) {
        this.orders = options;
        console.log(options)
        this.audio_url = "https://orangefreesounds.com/wp-content/uploads/2022/07/Clock-chimes-sounds.mp3?_=1";
        this.alarm_audio = new Audio(this.audio_url);
        this.alarm_status = false;
        this.id = [];
        if (options.length) {
            options.forEach(opt => {
                this.id.push(opt.identifier);
            });
        }
        this.intervalID;
        this.item = null;
        this.preview_state = "Attending";
        this.count_time = 0;
        this.rendered = false;
        this.sound_status = false;
        this.status_record = {
            "attending": {
                id: 1,
                time: 0
            },
            "sent": {
                id: 2,
                time: null
            },
            "processing": {
                id: 3,
                time: null
            },
            "completed": {
                id: 4,
                time: null
            },
            "delivering": {
                id: 5,
                time: null
            },
            "delivered": {
                id: 6,
                time: null
            },
            "invoiced": {
                id: 7,
                time: null
            }
        };
        this.state_alert_time = {
            "Attending": 2,
            "Sent": 5,
            "Processing": 25,
            "Completed": 10,
            "Delivering": 10,
            "Delivered": 25,
            "Invoiced": 5
        };
        this.process_status_data = {
            sent: {
                color: "steelblue",
                icon: "fa fa-paper-plane-o",
                next_action_message: "Confirm",
                status_message: "Whiting"
            },
            processing: {
                color: "#618685",
                icon: "fa fa-gear",
                next_action_message: "Complete",
                status_message: "Processing"
            },
            completed: {
                color: "green",
                icon: "fa fa-check",
                next_action_message: "Deliver",
                status_message: "Completed"
            },
            delivering: {
                color: "#ff7b25",
                icon: "fa fa-reply",
                next_action_message: "Deliver",
                status_message: "Delivering"
            },
            delivered: {
                color: "green",
                icon: "fa fa-cutlery",
                next_action_message: "Invoice",
                status_message: "Delivered",
            }
        }
    }

    async init() {
        await this.add_status_record();

        await frappe.db.get_list(
            "Customer",
            {
                filters: {
                    customer_name: "AHMED ALAA"
                },
                fields: "*",
                limit: 40
            }
        ).then(r => {
            this.customer_info = r[0];
        });
        this.render();
    }

    genRand = (len) => {
        return Math.random().toString(36).substring(2, len + 2);
    }

    async add_status_record() {
        let list = await frappe.db.get_list(
            "Order Status", {
            filters: {
                'order_name': this.orders[0].order_name,
                'current_status': this.orders[0].status
            },
            fields: "*",
            limit: 40
        }
        );

        // Error occured in here.
        let list1 = [];
        list.map(li => {
            let flag = false;
            this.orders.forEach(order => li.order_entry_id.includes(order.identifier) && (flag = true));
            if (flag) {
                list1.push(li);
            }
        });

        list = list1;

        if (list.length === 0) {
            const result = await frappe.db.insert({
                "doctype": "Order Status",
                "order_entry_id": JSON.stringify(this.id),
                "order_name": this.orders[0].order_name,
                "current_status": this.orders[0].status,
                "attending": 0,
                "sent": 0,
                "processing": 0,
                "completed": 0,
                "delivering": 0,
                "delivered": 0,
                "invoiced": 0
            });
            this.status_record_name = result.name;
        } else {
            this.status_record_name = list[0].name;
            this.status_record = {
                "attending": {
                    id: 1,
                    time: 0
                },
                "sent": {
                    id: 2,
                    time: list[0].sent
                },
                "processing": {
                    id: 3,
                    time: list[0].processing
                },
                "completed": {
                    id: 4,
                    time: list[0].completed
                },
                "delivering": {
                    id: 5,
                    time: list[0].delivering
                },
                "delivered": {
                    id: 6,
                    time: list[0].delivered
                }
            };
            this.update_status();
        }
    }

    update_status() {
        let elem = document.querySelector(`#food-command-${this.status_record_name} .time-record`);
        if (elem) {
            elem.parentNode.removeChild(elem);
            const els = `
                <ul class="time-record">
                    <li><span>Attending:</span> 0 Second</li>
                    <li><span>Sent:</span> ${this.calc_time(this.status_record.sent.time)}</li>
                    <li><span>Processing:</span> ${this.calc_time(this.status_record.processing.time)}</li>
                    <li><span>Completed:</span> ${this.calc_time(this.status_record.completed.time)}</li>
                    <li><span>Delivering:</span> ${this.calc_time(this.status_record.delivering.time)}</li>
                    <li><span>Delivered:</span> ${this.calc_time(this.status_record.delivered.time)}</li>
                </ul>
            `;
            let target_el = document.querySelector(`#food-command-${this.status_record_name}`);
            target_el.insertAdjacentHTML("beforeend", els);
        }
    }

    get html_detail() {
        let tmp = "";
        this.orders.forEach(order => {
            tmp += `
                <tr>
                    <td class="tb-order-name">${order.item_name}</td>
                    <td class="tb-order-qty">${order.qty}</td>
                    <td class="tb-order-rate">${RM.format_currency(order.rate)}</td>
                    <td class="tb-order-total">${RM.format_currency(order.amount)}</td>
                </tr>
            `
        });
        return `
            <table>
                <thead>
                    <tr>
                        <td>Name</td>
                        <td>Qty</td>
                        <td>Rate</td>
                        <td>Total</td>
                    </tr>
                </thead>
                <tbody>
                    ${tmp}
                </tbody>
            </table>
        `;
    }

    get time_elapsed() {
        if(this._time_elapsed) {
            this._time_elapsed.val(RMHelper.prettyDate(this.orders[0].ordered_time, true, time_elapsed => {
                this.show_alert_time_elapsed(time_elapsed);
            }));
        } else {
            this.show_alert_time_elapsed(0);
        }
    }

    render() {
        if (!this.rendered) {
            this.action_button = frappe.jshtml({
                tag: "h5",
                properties: {
                    class: `btn btn-default btn-flat btn-food-command`,
                    style: 'border-radius: 0 !important'
                },
                content: '{{text}}<i class="fa fa-chevron-right pull-right" style="font-size: 16px; padding-top: 2px;"></i>',
                text: this.orders[0].process_status_data.next_action_message,
            }).on("click", () => {
                this.execute();
            }, !RM.restrictions.to_change_status_order ? DOUBLE_CLICK : null)

            this.status_label = frappe.jshtml({
                tag: "h5",
                properties: {
                    class: "btn btn-flat btn-food-command status-label",
                    style: `background-color: ${this.orders[0].process_status_data.color};`
                },
                content: `<i class="${this.orders[0].process_status_data.icon} pull-left status-label-icon"></i> ${this.orders[0].process_status_data.status_message}`,
            });

            this._time_elapsed = frappe.jshtml({
                tag: "strong",
                properties: {
                    style: "font-size: 20px; left: 100%; position: sticky;"
                },
                content: ''
            });

            this.description = frappe.jshtml({
                tag: "span",
                content: `${this.orders[0].table_description} | ${this.orders[0].short_name}<i class="fa fa-print" style="margin-left: 10px; font-size: 16px;"></i>`,
            });

            this.title = frappe.jshtml({
                tag: "h5",
                properties: {
                    id: `food-command-title-${this.status_record_name}`
                },
                content: `${this.description.html()} ${this._time_elapsed.html()}`,
            }).on("click", () => {
                this.print_modal();
            }, !RM.restrictions.to_change_status_order ? DOUBLE_CLICK : null);

            this.item = frappe.jshtml({
                tag: "article",
                properties: {
                    class: "food-command-container"
                },
                content: this.template
            });

            $(this.process_manage.command_container()).append(
                this.item.html()
            );

            this.rendered = true;
            this.show_notes();

            this.time_elapsed;
        }
    }

    get template() {
        this.detail = frappe.jshtml({
            tag: "div",
            properties: {
                class: "row food-command-detail"
            },
            content: this.html_detail
        });
        this.notes = frappe.jshtml({
            tag: "div",
            properties: { class: "row product-notes", style: "display: none;" },
            content: '<h6 style="width: 100%;">{{text}}</h6>',
            text: ""
        });

        return `			
		<div class="food-command">
			<div class="food-command-title">
				${this.title.html()}
                <div class="food-body-cover" id="food-command-${this.status_record_name}">
                    <div class="customer-info">
                        <h4 style="padding-top: 20px;">Customer Info</h4>
                        <ul style="padding: 0;">
                            <li><span>Name:</span> ${this.customer_info.customer_name}</li>
                            <li><span>Address:</span> ${this.customer_info.building_number ? this.customer_info.building_number : ""} ${this.customer_info.street ? this.customer_info.street : ""} ${this.customer_info.region_city ? this.customer_info.region_city : ""} ${this.customer_info.country_ ? this.customer_info.country_ : ""}</li>
                            <li><span>Mobile Number:</span> ${this.customer_info.mobile_no}</li>
                        </ul>
                    </div>
                    <ul class="time-record">
                        <li><span>Attending:</span> 0 Second</li>
                        <li><span>Sent:</span> ${this.calc_time(this.status_record.sent.time)}</li>
                        <li><span>Processing:</span> ${this.calc_time(this.status_record.processing.time)}</li>
                        <li><span>Completed:</span> ${this.calc_time(this.status_record.completed.time)}</li>
                        <li><span>Delivering:</span> ${this.calc_time(this.status_record.delivering.time)}</li>
                        <li><span>Delivered:</span> ${this.calc_time(this.status_record.delivered.time)}</li>
                    </ul>
                </div>
			</div>
            <div class="food-command-body">
                ${this.detail.html()}
                ${this.notes.html()}
            </div>
			<div class="food-command-footer" id=food-command-footer-${this.status_record_name}>
				<div style="display: table-cell">
					${this.status_label.html()}
				</div>
				<div style="display: table-cell">
					${this.action_button.html()}
				</div>
			</div>
		</div>`
    }

    show_notes() {
        setTimeout(() => {
            if (this.notes.obj != null) {
                if (typeof this.orders[0].notes == "object" || this.orders[0].notes === "" || this.orders[0].notes === "") {
                    this.notes.val(__("No annotations")).hide();
                } else {
                    this.notes.val(this.orders[0].notes).show();
                }
            }
        }, 0);
    }

    calc_time(num) {
        let result = "";

        if (num) {
            let day = Math.floor(num / 86400);
            num = num - day * 86400;
            let hour = Math.floor(num / 3600);
            num = num - hour * 3600;
            let min = Math.floor(num / 60);
            num = num - min * 60;


            if (day) {
                result += `${day} ${day === 1 ? "Day" : "Days"} `;
            }
            if (hour) {
                result += `${hour} ${hour === 1 ? "Hour" : "Hours"} `;
            }
            if (min) {
                result += `${min} ${min === 1 ? "Min" : "Mins"} `;
            }
            result += `${num} ${num === 0 || num === 1 ? "Second" : "Seconds"} `;
        } else {
            result = "0 Second"
        }

        return result;
    }

    show_alert_time_elapsed(time_elapsed) {
        const alert_min = this.state_alert_time[this.orders[0].status];
        const orange_time = 60 * 2;
        const alert_time = 60 * alert_min;
        this.count_time = time_elapsed;

        const preview_status_time = this.get_preview_status_time(time_elapsed);
        let time_delta = time_elapsed - preview_status_time;

        if (this.preview_state !== this.orders[0].status || this.orders[0].status === "Invoiced") {
            this.preview_state !== this.orders[0].status && (this.preview_state = this.orders[0].status);
            this.orders[0].status === "Invoiced" && (this.preview_state = "Invoiced");
            this.alarm_status = false;
            this.stop_alarm_sound();
        }
        
        let timer = document.querySelector(`#food-command-title-${this.status_record_name} strong`);
        
        if(timer) {
            if (time_delta <= orange_time) {
                timer.style.color = 'orange';
            } else if (time_delta > orange_time && time_delta <= alert_time) {
                timer.style.color = 'green';
            } else if (time_delta > alert_time) {
                timer.style.color = 'red';
                if (!this.alarm_status) {
                    this.alarm_status = true;
                    this.play_alarm_sound();
                }
            }
        }
    }

    get_preview_status_time(time_elapsed) {
        return Math.max(
            this.status_record.attending.time,
            this.status_record.sent.time < time_elapsed ? this.status_record.sent.time : 0,
            this.status_record.processing.time < time_elapsed ? this.status_record.processing.time : 0,
            this.status_record.completed.time < time_elapsed ? this.status_record.completed.time : 0,
            this.status_record.delivering.time < time_elapsed ? this.status_record.delivering.time : 0,
            this.status_record.delivered.time < time_elapsed ? this.status_record.delivered.time : 0
        )
    }

    play_alarm_sound() {
        if (!this.sound_status) {
            this.sound_status = true;
            this.alarm_audio.play();
            this.intervalID = setInterval(() => {
                this.alarm_audio.play()
            }, this.alarm_audio.duration * 500);
            this.alarm_audio.play()
        }
    }

    stop_alarm_sound() {
        this.alarm_audio.pause();
        this.alarm_audio.currentTime = 0;
        this.intervalID && clearInterval(this.intervalID);
        this.sound_status = false;
    }

    update_title() {
        this.description.val(this.data.table_description + " | " + this.data.short_name);
    }

    refresh_html() {
        const psd = this.orders[0].process_status_data;
        this.update_title();
        this.detail.val(this.html_detail);
        this.action_button.val(psd.next_action_message);

        this.show_notes();

        this.status_label.val(
            `<i class="${psd.icon} pull-left" style="font-size: 22px"></i> ${psd.status_message}`
        ).css([
            { prop: "background-color", value: psd.color }
        ]);
    }

    remove() {
        this.item.remove();

        const items = Object.keys(this.process_manage.items);

        this.process_manage.items[this.orders[0].order_name].status[this.orders[0].status] = [];
        delete this.process_manage.items[this.orders[0].order_name + '_' + this.orders[0].status]
        // items.forEach((item) => {
        //     if (this.process_manage.command_items[item].data.identifier === this.data.identifier) {
        //         delete this.process_manage.items[item];
        //     }
        // });
    }

    renameObjectKey(object, oldKey, newKey) {
        // if keys are the same, do nothing
        if (oldKey === newKey) return;
        // if old key doesn't exist, do nothing (alternatively, throw an error)
        if (!object[oldKey]) return;
        // if new key already exists on object, do nothing (again - alternatively, throw an error)
        if (object[newKey] !== undefined) return;

        object = { ...object, [newKey]: object[oldKey] };
        delete object[oldKey];

        return { ...object };
    };

    async execute() {
        if (RM.busy_message()) {
            return;
        }
        RM.working(this.orders[0].status, false);

        const status = ["Attending", "Sent", "Processing", "Completed", "Delivering", "Delivered", "Invoiced"]

        let index = status.findIndex(st => st === this.orders[0].status);

        let check_next_step = [];

        if(status[index + 1] !== "Invoiced") {
            check_next_step = await frappe.db.get_list("Order Status",{
                filters: {
                    'order_name': this.orders[0].order_name,
                    current_status: status[index + 1]
                },
                fields: "*",
                limit: 40
            });
        } else {
            this.remove();
        }

        if(check_next_step.length < 1) {
            this.status_record[this.orders[0].status.toLowerCase()].time = Math.floor(this.count_time);
            this.update_status();

            frappe.db.set_value("Order Status", this.status_record_name, {
                current_status: status[index + 1],
                [this.orders[0].status.toLowerCase()]: Math.floor(this.count_time)
            });

            let tmp;
    
            for (let i = 0; i < this.orders.length; i++) {
                let res = await frappe.db.set_value("Order Entry Item", this.orders[i].entry_name ? this.orders[i].entry_name : this.orders[i].name, {
                    status: status[index + 1]
                });
                tmp = res.message;
            }
    
            this.orders = tmp.entry_items;
            this.process_manage.command_items[tmp.name + '_' + status[index]].process_manage.items[tmp.name].status[status[index].toLowerCase()] = [];
            this.process_manage.command_items[tmp.name + '_' + status[index]].process_manage.items[tmp.name].status[status[index + 1].toLowerCase()] = this.orders;
            this.process_manage.command_items = this.renameObjectKey(this.process_manage.command_items, tmp.name + '_' + status[index], tmp.name + '_' + status[index + 1])
            this.process_manage.items[tmp.name].status[status[index].toLowerCase()] = [];
            this.process_manage.items[tmp.name].status[status[index + 1].toLowerCase()] = this.orders;
            
            let elem = document.querySelector(`#food-command-footer-${this.status_record_name}`);
            let child = elem.lastElementChild;
            while (child) {
                elem.removeChild(child)
                child = elem.lastElementChild;
            }

            const curr_status = this.process_status_data[status[index + 1].toLowerCase()];
            this.action_button = frappe.jshtml({
                tag: "h5",
                properties: {
                    class: `btn btn-default btn-flat btn-food-command`,
                    style: 'border-radius: 0 !important'
                },
                content: '{{text}}<i class="fa fa-chevron-right pull-right" style="font-size: 16px; padding-top: 2px;"></i>',
                text: curr_status.next_action_message
            }).on("click", () => {
                this.execute();
            }, !RM.restrictions.to_change_status_order ? DOUBLE_CLICK : null)

            this.status_label = frappe.jshtml({
                tag: "h5",
                properties: {
                    class: "btn btn-flat btn-food-command status-label",
                    style: `background-color: ${curr_status.color};`
                },
                content: `<i class="${curr_status.icon} pull-left status-label-icon"></i> ${curr_status.status_message}`,
            });

            const el = `
                <div style="display: table-cell">
                    ${this.status_label.html()}
                </div>
                <div style="display: table-cell">
                    ${this.action_button.html()}
                </div>
            `;
            elem.insertAdjacentHTML("afterbegin", el);
        } else {
            frappe.show_alert({
                message:__("You can't move this card to next step. There is a card at that status already."),
                indicator:'red'
            }, 5);
        }
    }

    async print_modal() {
        const title = this.orders[0].order_name + " (" + __("Account") + ")";
        const order_manage = this.order_manage;
        const props = {
            model: "Table Order",
            model_name: this.orders[0].order_name,
            from_server: true,
            args: {
                format: "Order Account",
                _lang: 'en-US',
                no_letterhead: 1,
                letterhead: 'No%20Letterhead'
            },
            set_buttons: true,
            is_pdf: true,
            customize: true,
            title: title
        }

        // if (order_manage.print_modal) {
        //     order_manage.print_modal.set_props(props);
        //     order_manage.print_modal.set_title(title);
        //     order_manage.print_modal.reload().show();
        // } else {
        //     order_manage.print_modal = new DeskModal(props);
        // }
        new DeskModal(props);
    }
}