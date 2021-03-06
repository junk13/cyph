const fs						= require('fs');
const ical						= require('ical-generator');
const mustache					= require('mustache');
const nodemailer				= require('nodemailer');
const {dompurifyHtmlSanitizer}	= require('./dompurify-html-sanitizer');
const auth						= require('./email-credentials');
const {render, renderTemplate}	= require('./markdown-templating');
const namespaces				= require('./namespaces');
const {normalize}				= require('./util');


const transporter	= nodemailer.createTransport({auth, service: 'gmail'});

const template		= new Promise((resolve, reject) => {
	fs.readFile(__dirname + '/email.html', (err, data) => {
		if (err) {
			reject(err);
		}
		else {
			resolve(data.toString());
		}
	});
});

const getEmailAddress	= async (database, namespace, username) => {
	let email, name;

	if (typeof username === 'object') {
		email	= username.email;
		name	= username.name;
	}
	else {
		const internalURL	= `${namespace}/users/${normalize(username)}/internal`;

		[email, name]		= (await Promise.all(['email', 'name'].map(async k =>
			database.ref(`${internalURL}/${k}`).once('value')
		))).map(o =>
			o.val() || undefined
		);
	}

	return {
		email,
		formatted: !email ? undefined : !name ? email : `${name} <${email}>`,
		name
	};
};

const sendMailInternal	= async (
	to,
	subject,
	text,
	eventDetails,
	eventInviter,
	accountsURL
) => {
	if (typeof text === 'object') {
		if (!accountsURL && text.namespace) {
			accountsURL	= namespaces[text.namespace].accountsURL;
		}

		const data	= {
			...(typeof text.data === 'object' ? text.data : {}),
			accountsURL
		};

		text	=
			text.template ?
				render(text.template, data) :
			text.templateName ?
				await renderTemplate(text.templateName, data) :
				undefined
		;
	}

	return transporter.sendMail({
		from: `Cyph <${auth.user}>`,
		html: !text ? '' : dompurifyHtmlSanitizer.sanitize(
			mustache.render(await template, {
				accountsURL,
				...(
					typeof text === 'object' ?
						{html: text.html} :
						{lines: text.split('\n')}
				)
			})
		),
		icalEvent: !eventDetails ? undefined : {
			content: ical({
				domain: 'cyph.com',
				events: [{
					attendees: [to, eventInviter],
					description: eventDetails.description,
					end: new Date(eventDetails.endTime),
					location: eventDetails.location,
					organizer: eventInviter,
					start: new Date(eventDetails.startTime),
					summary: eventDetails.summary || subject
				}],
				prodId: '//cyph.com//cyph-appointment-scheduler//EN'
			}).toString(),
			filename: 'invite.ics',
			method: 'request'
		},
		subject,
		text: (typeof text === 'object' ? text.markdown : text) || '',
		to: typeof to === 'string' ? to : to.formatted
	});
};

/**
 * @param {{
 *     description: string;
 *     endTime: number;
 *     inviterUsername: string;
 *     location: string;
 *     startTime: number;
 *     summary: string;
 * }} eventDetails
 * @param {(
 *     {data?: Record<string, string>; template: string}|
 *     {data?: Record<string, string>; templateName: string}|
 *     string
 * )} text
 */
const sendMail			= async (database, namespace, username, subject, text, eventDetails) => {
	const to	= await getEmailAddress(database, namespace, username);

	if (!to.formatted) {
		return;
	}

	const eventInviter	= eventDetails && eventDetails.inviterUsername ?
		await getEmailAddress(database, namespace, eventDetails.inviterUsername) :
		undefined
	;

	await sendMailInternal(
		to,
		subject,
		text,
		eventDetails,
		eventInviter,
		namespaces[namespace].accountsURL
	);
};


module.exports	= {sendMail, sendMailInternal};
